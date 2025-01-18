import type { Listener } from '@alessiofrittoli/event-emitter'

/**
 * Represents a chunk of data that can be read, which can either be of type `T` or a promise that resolves to `T`.
 *
 * @template T - The type of the data chunk. Defaults to `unknown` if not specified.
 */
export type ReadChunk<T = unknown> = T | Awaited<T>



/**
 * Represents an Array of `ReadChunk` objects.
 * 
 * @template O - The type of data contained in each `ReadChunk`.
 */
export type ReadChunks<O = unknown> = ReadChunk<O>[]


/**
 * Custom additional options.
 * 
 * @template I The type of the input chunk. Defaults to `unknown`.
 * @template O The type of the output chunk. Defaults to `I`.
 */
export interface Options<I = unknown, O = I>
{
	/** A function that transforms a chunk of data. */
    transform?: TransformChunk<I, O>
	/** Allows to opt-out from in-memory chunks collection. */
	inMemory?: boolean
}


/**
 * A function that transforms a chunk of data.
 *
 * @template I - The type of the input chunk. Defaults to `unknown`.
 * @template O - The type of the output chunk. Defaults to `unknown`.
 *
 * @param chunk - The chunk of data to be transformed.
 * @returns The transformed chunk of data, which can be either a synchronous result or a Promise that resolves to the result.
 */
export type TransformChunk<I = unknown, O = I> = ( chunk: ReadChunk<I> ) => ( ReadChunk<O> | PromiseLike<ReadChunk<O>> )


/**
 * Event types emitted by the StreamReader.
 * @template O The type of data being read from the stream and eventually transformed before the event is emitted.
 */
export type StreamReaderEvents<O = unknown> = {
	/**
	 * Emitted when a chunk of data is read from the stream.
	 * @param chunk The chunk of data read from the stream.
	 */
	data: [ chunk: ReadChunk<O> ]


	/**
	 * Emitted when the stream is closed.
	 * @param chunks An array of chunks read from the stream before it was closed.
	 */
	close: [ chunks: ReadChunks<O> ]


	/**
	 * Emitted when an error occurs during reading.
	 * @param error The error that occurred during the reading process.
	 */
	error: [ error: Error ]


	/**
	 * Emitted when the reading process is canceled.
	 * @param reason A DOMException explaing the reason for aborting the operation.
	 */
	cancel: [ reason: DOMException ]
}


/**
 * Listener for the "read" event.
 * 
 * @template O The type of data being read from the stream and eventually transformed before the event is emitted.
 */
export type OnReadEventListener<O = unknown> = Listener<StreamReaderEvents<O>, 'data'>


/**
 * Listener for the "close" event.
 * 
 * @template O The type of data being read from the stream and eventually transformed before the event is emitted.
 */
export type OnCloseEventListener<O = unknown> = Listener<StreamReaderEvents<O>, 'close'>



/**
 * Listener for the "abort" event.
 * 
 * This type represents a listener function that is invoked when an 'abort' event occurs.
 * It is used to define the shape of the listener function that can be registered to handle
 * such events.
 */
export type OnCancelEventListener = Listener<StreamReaderEvents, 'cancel'>


/**
 * Listener for the "error" event.
 */
export type OnErrorEventListener = Listener<StreamReaderEvents, 'error'>


/**
 * A generator that produces chunks of data asynchronously.
 * This can be a regular or async generator.
 * @template T The type of data produced by the generator.
 */
export type StreamGenerator<T = unknown> = (
	| Generator<T, void, unknown>
	| AsyncGenerator<T, void, unknown>
)