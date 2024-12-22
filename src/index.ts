import EventEmitter from 'events'

/**
 * Event types emitted by the StreamReader.
 * @template T The type of data being read from the stream.
 */
type StreamReaderEvents<T = unknown> = {
	/** Emitted when a chunk of data is read from the stream. */
	read: [ ReadableStreamDefaultController, boolean, T ]
	/** Emitted when the stream is closed. */
	close: [ ReadableStreamDefaultController ]
	/** Emitted when an error occurs during reading. */
	error: [ Error ]
}


/**
 * A utility class for reading from a `ReadableStream`.
 * @template T The type of data being read from the stream.
 */
class StreamReader<T = unknown> extends EventEmitter<StreamReaderEvents<T>>
{
	/** The reader obtained from the input `ReadableStream`. */
	reader: ReadableStreamDefaultReader<T>
	/** Indicates whether the stream has been closed. */
	closed: boolean

	/**
	 * Creates an instance of `StreamReader`.
	 * @param stream The input `ReadableStream` to read data from.
	 */
	constructor( stream: ReadableStream<T> )
	{
		super( { captureRejections: true } )

		this.reader = stream.getReader()
		this.closed = false
	}

	/**
	 * Creates a new `ReadableStream` that reads from the input stream and emits events.
	 * @returns A `ReadableStream` that can be consumed.
	 */
	read()
	{
		return new ReadableStream<T>( {
			start: this.pump
		} )
	}


	/**
	 * Reads data from the input stream and pushes it to the output stream.
	 * Emits `read` and `error` events during the process.
	 * @private
	 * @param controller The `ReadableStreamDefaultController` controlling the output stream.
	 * @returns A promise that resolves when the stream is fully read or an error occurs.
	 */
	private pump( controller: ReadableStreamDefaultController<T> ): Promise<void>
	{
		return (
			this.reader.read()
				.then( ( { done, value } ) => {

					if ( done ) {
						return this.close( controller )
					}

					this.emit( 'read', controller, done, value )
					controller.enqueue( value )
					return this.pump( controller )
				} )
				.catch( err => {
					const error = err as Error
					controller.error( error )
					this.emit( 'error', error )
					this.close( controller )
				} )
		)
	}
	
	
	/**
	 * Closes the stream and releases the lock on the reader.
	 * Emits the `close` event.
	 * @param controller The `ReadableStreamDefaultController` controlling the output stream.
	 */
	close( controller: ReadableStreamDefaultController<T> )
	{
		if ( this.closed ) return
		this.emit( 'close', controller )
		controller.close()
		this.reader.releaseLock()
		this.closed = true
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
	readChunks()
	{
		const { reader } = this
		return {
			async* [ Symbol.asyncIterator ]()
			{
				let readResult = await reader.read()
				while ( ! readResult.done ) {
					yield readResult.value
					readResult = await reader.read()
				}
			},
		}
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
	static iteratorToStream<T = unknown>( iterator: Generator<T, void, unknown> | AsyncGenerator<T, void, unknown> )
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


export default StreamReader