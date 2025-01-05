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