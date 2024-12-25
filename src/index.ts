import EventEmitter from 'events'
import type { StreamGenerator, StreamReaderEvents } from './types'


/**
 * A utility class for reading from a `ReadableStream`.
 * @template T The type of data being read from the stream.
 */
export class StreamReader<T = unknown> extends EventEmitter<StreamReaderEvents<T>>
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
	 * Read on-demand stream data.
	 * 
	 * @returns A Array of `T`.
	 */
	async read()
	{
		const chunks: Awaited<T>[] = []
		try {
			for await ( const chunk of this.readChunks() ) {
				chunks.push( chunk )
				this.emit( 'read', chunk )
			}
			this.close( chunks )
			return chunks
		} catch ( error ) {
			this.error( error as Error )
		}
		return chunks
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
	 * @param chunks The stream final chunks array.
	 * @returns `StreamReader<T>` for chaining purposes.
	 */
	close( chunks: Awaited<T>[] )
	{
		if ( this.closed ) return this
		this.closed = true
		this.reader.releaseLock()
		this.emit( 'close', chunks )
		this.removeAllListeners( 'read' )
		this.removeAllListeners( 'close' )
		return this
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
		this.removeAllListeners( 'read' )
		this.removeAllListeners( 'close' )
		if ( ! this.listenerCount( 'error' ) ) {
			throw error
		}
		this.emit( 'error', error )
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