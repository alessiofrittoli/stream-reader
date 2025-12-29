import { Readable, Transform } from 'stream'
import { clamp } from '@alessiofrittoli/math-utils'
import type { StreamGenerator } from './types'


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
export const generatorToReadableStream = <T = unknown>( generator: StreamGenerator<T> ) => (
	new ReadableStream<T>( {
		async pull( controller )
		{

			const { value, done } = await generator.next()

			if ( ! done ) return controller.enqueue( value )

			return controller.close()

		},
	} )
)


/**
 * Defines the resolved Promise result of the extraction data from a Readable.
 * 
 */
export type ExtractedBytes = [
	/**
	 * A Buffer containing the extracted data bytes.
	 * 
	 */
	ExtractedData: Buffer,
	/**
	 * The piped `Transform` stream that forward the remaining data to the next piped destination.
	 * 
	 */
	input: Transform
]


/**
 * Extracts a specified number of bytes from a Node.js Readable stream.
 * 
 * This function reads data from the provided Readable stream until the specified
 * number of bytes has been extracted. The extracted bytes are returned as a Buffer,
 * along with a Transform stream that can be used to continue processing the remaining
 * data in the stream.
 * 
 * If the stream ends before the required number of bytes is read, the returned Promise
 * will be rejected with an error.
 * 
 * @param input The Node.js Readable stream to extract bytes from.
 * @param bytes The number of bytes to extract from the stream.
 * 
 * @returns A new Promise that resolves to a tuple containing:
 *   - The extracted Buffer of the requested length.
 *   - The Transform stream that can be used to continue reading the rest of the data.
 * 
 * @throws `Error` If the input stream ends before the required number of bytes is extracted.
 * 
 * @example
 * 
 * ```ts
 * const [ header, restStream ] = await extractBytesFromReadable( inputStream, 16 );
 * // `header` is a Buffer of 16 bytes, `restStream` is a the piped `Transform` stream that forward the remaining data to the next piped destination.
 * ```
 */
export const extractBytesFromReadable = ( input: Readable, bytes: number ) => (
	new Promise<ExtractedBytes>( ( resolve, reject ) => {

		const bytesToExtract = clamp( bytes, 0, Infinity )
		/**
		 * A Buffer containing all the byte data we want to extract.
		 * 
		 */
		let ExtractedData = Buffer.alloc( 0 )
		/**
		 * Indicates how many bytes we've read from incoming stream.
		 * 
		 */
		let bytesRead = 0
		/**
		 * Indicates whether we successfully extracted required byte data
		 * and already resolved the current Promise.
		 */
		let resolved = false
		
		const transform = new Transform( {
			transform( chunk: Buffer, encoding, callback ) {

				if ( bytesRead < bytesToExtract ) {

					// append to the current `ExtractedData` the incoming chunk.
					ExtractedData = Buffer.concat( [ ExtractedData, chunk ] )
					
					// increment the bytes we've read.
					bytesRead += chunk.length
					
					/**
					 * Indicates whether we fully extracted the byte data and the last chunk
					 * also contains part of the data we do not want to extract.
					 * 
					 * This may occurs when the received chunk length is not a multiple of the given `bytes`.
					 * In this case the chunk will contain mixed content:
					 * - end of the `ExtractedData`.
					 * - begin of data that we do not want to extract.
					 */
					const hasByteLoss = ExtractedData.length > bytesToExtract
					
					/**
					 * A Buffer containing chunk data unrelated with the requested extraction data.
					 * 
					 */
					const bytesLoss = hasByteLoss ? ExtractedData.subarray( bytesToExtract ) : undefined
					
					// Cut-off extracted data to make sure it exactly matches the requested `bytes`.
					ExtractedData = ExtractedData.subarray( 0, bytesToExtract )
					
					if ( bytesLoss ) {
						// send rest of the chunk to the next piped destination.
						this.push( bytesLoss, encoding )
					}

					if ( ! resolved && ExtractedData.length === bytesToExtract ) {
						// resolve the Promise so user can immediately obtain the `ExtractedData`.
						resolved = true
						resolve( [ ExtractedData, this ] )
					}

					// early return with loop-back.
					return callback()
				}


				/**
				 * Resolve the Promise so user can immediately obtain the `ExtractedData`.
				 * 
				 * This cover an edge case scenario where given `bytes` to extract is less than or equal to `0`.
				 */
				if ( ! resolved && ExtractedData.length === bytesToExtract ) {
					resolved = true
					resolve( [ ExtractedData, this ] )
				}


				bytesRead += chunk.length

				// keep pushing un-modified data to the next piped destination.
				this.push( chunk, encoding )

				// loop-back
				return callback()
			},
			final( callback ) {
				if ( ExtractedData.length < bytesToExtract ) {
					return callback(
						new Error(
							'The extracted data Buffer length is less than the expected length. This may be caused if given input data length is less than the data length you want to extract.'
						)
					)
				}
				return callback()
			},
		} )

		transform.on( 'error', reject )

		input.on( 'error', error => {
			transform.destroy( error )
			reject( error )
		} )

		input.pipe( transform )

	} )
)