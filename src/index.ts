import EventEmitter from 'events'
import type {
	ReadChunk,
	ReadChunks,
	StreamGenerator,
	StreamReaderEvents,
	TransformChunk
} from './types'

/**
 * A class for reading data from a `ReadableStream` on demand.
 * 
 * @template I The type of input data being read from the stream.
 * @template O The type of output data transformed after reading from the stream. Defaults to the same type of `I`.
 * 
 * @extends EventEmitter<StreamReaderEvents<O>>
 * 
 * @example
 * ```ts
 * const response = await fetch( 'https://example.com/data' )
 * if ( response.body ) {
 * 	const reader = new StreamReader( response.body )
 * 	const chunks = await reader.read()
 * }
 * ```
 * 
 * @returns A new instance of `StreamReader<T>`.
 */
export class StreamReader<I = unknown, O = I> extends EventEmitter<StreamReaderEvents<O>>
{
	/** The reader obtained from the input `ReadableStream`. */
	reader: ReadableStreamDefaultReader<I>
	/** Indicates whether the stream has been closed. */
	closed: boolean
	/**
	 * Stores the chunks of data that have been received.
	 * 
	 * @private
	 */
	private receivedChunks: ReadChunks<O>
	
	
	/**
	 * Creates an instance of `StreamReader<T>`.
	 * @param stream The input `ReadableStream<T>` to read data from.
	 */
	constructor( stream: ReadableStream<I> )
	{
		super( { captureRejections: true } )

		this.reader	= stream.getReader()
		this.closed	= false
		this.receivedChunks = []
	}


	/**
	 * Asynchronously reads on-demand stream data.
	 * 
	 * Optionally transform each chunk using the provided transform function.
	 * Emits a 'read' event for each chunk after it has been processed.
	 * If an error occurs during the reading process, it is caught and passed to the `error` method.
	 * 
	 * @template I - The type of the input chunks.
	 * @template O - The type of the output chunks after transformation.
	 * @param transform - (Optional) A function that transforms each chunk.
	 * @returns A new Promise that resolves to an array of processed chunks.
	 */
	async read( transform?: TransformChunk<I, O> )
	{
		try {
			for await ( const chunk of this.readChunks() ) {
				const processed = ( typeof transform === 'function' ? await transform( chunk ) : chunk ) as ReadChunk<O>
				this.receivedChunks.push( processed )
				this.emit( 'read', processed )
			}
			return (
				this.close()
					.receivedChunks
			)
		} catch ( error ) {
			return (
				this.error( error as Error )
					.receivedChunks
			)
		}
	}


	/**
	 * Provides an async generator for reading chunks from the input stream.
	 * 
	 * @example
	 * ```ts
	 * const response	= await fetch( ... )
	 * let data	= ''
	 * let resourceSize= 0
	 * 
	 * if ( response.body ) {
	 * 	const reader	= new StreamReader( response.body )
	 * 	const decoder	= new TextDecoder()
	 * 
	 *   for await ( const chunk of reader.readChunks() ) {
	 *     const decoded = decoder.decode( chunk, { stream: true } )
	 *     data += decoded
	 *     resourceSize += chunk.BYTES_PER_ELEMENT * chunk.length
	 * 
	 *     console.log( 'Chunk decoded:', decoded )
	 *   }
	 * }
	 * ```
	 * @returns An async iterable object for consuming chunks of data.
	 */
	async *readChunks(): AsyncGenerator<ReadChunk<I>, void, unknown>
	{
		const { reader } = this
		let readResult = await reader.read()
		while ( ! readResult.done ) {
			yield readResult.value
			readResult = await reader.read()
		}
	}


	/**
	 * Cancels the streaming reader operation.
	 *
	 * @param reason - Optional reason for aborting the operation.
	 * @returns A new Promise that resolves the `StreamReader<T>` for chaining purposes after aborting.
	 *
	 * @remarks
	 * This method will cancel the reader, release the lock, emit an 'cancel' event, and remove listeners.
	 */
	async cancel( reason?: string )
	{
		if ( this.closed ) return this
		
		this.closed		= true
		const exception	= new DOMException( reason || 'Streming reader cancelled.', 'AbortError' )
		exception.cause = DOMException.ABORT_ERR
		this.emit( 'cancel', exception )

		await this.reader.cancel( exception )
		this.reader.releaseLock()

		return this.removeListeners()
	}


	/**
	 * Closes the stream reader once the stream writer get closed.
	 * 
	 * Emits the `close` event.
	 * 
	 * @private This method is meant to be internally used when the stream writer get closed. Use `StreamReader<T>.cancel()` method if you need to stop reading before stream writer complete his task.
	 * @returns `StreamReader<T>` for chaining purposes.
	 * 
	 * @remarks
	 * This method sets the `closed` property to `true`, releases the lock on the reader,
	 * emits a `close` event with the received chunks, and removes listeners.
	 */
	private close()
	{
		if ( this.closed ) return this
		this.closed = true
		this.reader.releaseLock()
		this.emit( 'close', this.receivedChunks )
		return this.removeListeners()
	}


	/**
	 * Handles an error by marking the instance as closed, removing listeners, 
	 * and either throwing the error or emitting it as an `error` event.
	 *
	 * @param error - The error to handle.
	 * @throws Will throw the error if there are no `error` listeners.
	 * @returns `StreamReader<T>` for chaining purposes.
	 */
	private error( error: Error )
	{
		this.closed = true
		this.removeListeners()
		if ( ! this.listenerCount( 'error' ) ) {
			throw error
		}
		this.emit( 'error', error )
		return this
	}


	/**
	 * Removes all listeners for the `read`, `close`, and `cancel` events.
	 *
	 * @returns `StreamReader<T>` for chaining purposes.
	 */
	private removeListeners()
	{
		this.removeAllListeners( 'read' )
		this.removeAllListeners( 'close' )
		this.removeAllListeners( 'cancel' )

		return this
	}


	/**
	 * Convert a Generator or AsyncGenerator into a ReadableStream.
	 *
	 * @link https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream#convert_async_iterator_to_stream
	 *
	 * @template T The type of data produced by the iterator.
	 * 
	 * @param	generator The Generator or AsyncGenerator to convert.
	 * @returns	A new ReadableStream instance
	 */
	static generatorToReadableStream<T = unknown>( generator: StreamGenerator<T> )
	{
		return (
			new ReadableStream<T>( {
				async pull( controller )
				{

					const { value, done } = await generator.next()

					if ( ! done ) return controller.enqueue( value )

					return controller.close()

				},
			} )
		)
	}
}