import EventEmitter from 'events'
import type { ReadChunks, StreamGenerator, StreamReaderEvents } from './types'


/**
 * A class for reading data from a `ReadableStream` on demand.
 * 
 * @template T The type of data being read from the stream.
 * 
 * @extends EventEmitter<StreamReaderEvents<T>>
 * 
 * @example
 * ```ts
 * const response = await fetch('https://example.com/data');
 * if (response.body) {
 *   const reader = new StreamReader(response.body);
 *   for await (const chunk of reader.readChunks()) {
 *     console.log('Received chunk:', chunk);
 *   }
 * }
 * ```
 * 
 * @returns A new instance of `StreamReader`.
 */
export class StreamReader<T = unknown> extends EventEmitter<StreamReaderEvents<T>>
{
	/** The reader obtained from the input `ReadableStream`. */
	reader: ReadableStreamDefaultReader<T>
	/** Indicates whether the stream has been closed. */
	closed: boolean
	private receivedChunks: ReadChunks<T>

	
	/**
	 * Creates an instance of `StreamReader`.
	 * @param stream The input `ReadableStream` to read data from.
	 */
	constructor( stream: ReadableStream<T> )
	{
		super( { captureRejections: true } )

		this.reader	= stream.getReader()
		this.closed	= false
		this.receivedChunks = []
	}


	/**
	 * Read on-demand stream data.
	 * 
	 * @returns A Array of `T`.
	 */
	async read()
	{
		try {
			for await ( const chunk of this.readChunks() ) {
				this.receivedChunks.push( chunk )
				this.emit( 'read', chunk )
			}
			return (
				this.close()
					.then( () => this.receivedChunks )
			)
		} catch ( error ) {
			this.error( error as Error )
		}
		return this.receivedChunks
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
	async *readChunks()
	{
		const { reader } = this
		let readResult = await reader.read()
		while ( ! readResult.done ) {
			yield readResult.value
			readResult = await reader.read()
		}
	}

	
	/**
	 * Releases the lock on the reader.
	 * 
	 * Emits the `close` event.
	 * 
	 * @returns `StreamReader<T>` for chaining purposes.
	 */
	async close()
	{
		if ( this.closed ) return this
		this.closed = true
		this.reader.releaseLock()
		this.emit( 'close', this.receivedChunks )
		return this.removeListeners()
	}


	
	/**
	 * Aborts the streaming reader operation.
	 *
	 * @param reason - Optional reason for aborting the operation.
	 * @returns A new Promise that resolves to the current instance after aborting.
	 *
	 * @remarks
	 * This method will cancel the reader, release the lock, emit an 'abort' event, and remove listeners.
	 */
	async abort( reason?: string )
	{
		if ( this.closed ) return this
		
		this.closed		= true
		const exception	= new DOMException( reason || 'Streming reader aborted.', 'AbortError' )
		exception.cause = DOMException.ABORT_ERR

		await this.reader.cancel( exception )
		this.reader.releaseLock()
		this.emit( 'abort', exception )
		return this.removeListeners()
	}


	/**
	 * Releases the lock on the reader.
	 * 
	 * Emits the `error` event.
	 * 
	 * @param error The `Error` occured.
	 * @returns `StreamReader<T>` for chaining purposes.
	 */
	private error( error: Error )
	{
		this.closed = true
		this.reader.releaseLock()
		this.removeListeners()
		if ( ! this.listenerCount( 'error' ) ) {
			throw error
		}
		this.emit( 'error', error )
		return this
	}




	/**
	 * Removes all listeners for the 'read', 'close', and 'abort' events.
	 *
	 * @returns The current `StreamReader` instance for chaining.
	 */
	private removeListeners()
	{
		this.removeAllListeners( 'read' )
		this.removeAllListeners( 'close' )
		this.removeAllListeners( 'abort' )

		return this
	}


	/**
	 * Convert an Iterator into a ReadableStream.
	 *
	 * @link https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream#convert_async_iterator_to_stream
	 *
	 * @template T The type of data produced by the iterator.
	 * 
	 * @param	iterator The Iterator to convert.
	 * @returns	A new ReadableStream instance
	 */
	static generatorToReadableStream<T = unknown>( iterator: StreamGenerator<T> )
	{
		return (
			new ReadableStream<T>( {
				async pull( controller )
				{

					const { value, done } = await iterator.next()

					if ( ! done ) return controller.enqueue( value )

					return controller.close()

				},
			} )
		)
	}
}