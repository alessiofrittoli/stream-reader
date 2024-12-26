/**
 * Represents a chunk of data that can be read, which can either be of type `T` or a promise that resolves to `T`.
 *
 * @template T - The type of the data chunk. Defaults to `unknown` if not specified.
 */
export type ReadChunk<T = unknown> = T | Awaited<T>



/**
 * Represents an Array of `ReadChunk` objects.
 * 
 * @template T - The type of data contained in each `ReadChunk`.
 */
export type ReadChunks<T = unknown> = ReadChunk<T>[]


/**
 * A function that transforms a chunk of data.
 *
 * @template I - The type of the input chunk. Defaults to `unknown`.
 * @template O - The type of the output chunk. Defaults to `unknown`.
 *
 * @param chunk - The chunk of data to be transformed.
 * @returns The transformed chunk of data, which can be either a synchronous result or a Promise that resolves to the result.
 */
export type TransformChunk<I = unknown, O = unknown> = ( chunk: ReadChunk<I> ) => ( ReadChunk<O> | Promise<ReadChunk<O>> )


/**
 * Event types emitted by the StreamReader.
 * @template O The type of data being read from the stream and eventually transformed before the event is emitted.
 */
export type StreamReaderEvents<O = unknown> = {
	/**
	 * Emitted when a chunk of data is read from the stream.
	 * @param {ReadChunk<O>} chunk - The chunk of data read from the stream.
	 */
	read: [ ReadChunk<O> ]


	/**
	 * Emitted when the stream is closed.
	 * @param {ReadChunks<O>} chunks - An array of chunks read from the stream before it was closed.
	 */
	close: [ ReadChunks<O> ]


	/**
	 * Emitted when an error occurs during reading.
	 * @param {Error} error - The error that occurred during the reading process.
	 */
	error: [ Error ]


	/**
	 * Emitted when the reading process is canceled.
	 * @param {DOMException} reason - A DOMException explaing the reason for aborting the operation.
	 */
	cancel: [ DOMException ]
}


/**
 * A listener function for events emitted by the StreamReader.
 * 
 * @template K The event type to listen for.
 * @template O The type of data being read from the stream and eventually transformed before the event is emitted.
 * @param {...StreamReaderEvents<O>[ K ]} args - The arguments emitted with the event.
 */
export type Listener<
	K extends keyof StreamReaderEvents,
	O = unknown
> = ( ...args: StreamReaderEvents<O>[ K ] ) => void


/**
 * Listener for the "read" event.
 * 
 * @template O The type of data being read from the stream and eventually transformed before the event is emitted.
 * 
 * @param {ReadChunk<O>} chunk - The chunk of data that was read.
 */
export type OnReadEventListener<O = unknown> = Listener<'read', O>


/**
 * Listener for the "close" event.
 * 
 * @template O The type of data being read from the stream and eventually transformed before the event is emitted.
 * @param {ReadChunk<O>[]} chunks - An array of chunks read and eventually transformed before the stream was closed.
 */
export type OnCloseEventListener<O = unknown> = Listener<'close', O>



/**
 * Listener for the "abort" event.
 * 
 * This type represents a listener function that is invoked when an 'abort' event occurs.
 * It is used to define the shape of the listener function that can be registered to handle
 * such events.
 * 
 * @typedef {Listener<'cancel'>} OnCancelEventListener
 */
export type OnCancelEventListener = Listener<'cancel'>


/**
 * Listener for the "error" event.
 * @param {Error} error - The error that occurred during reading.
 */
export type OnErrorEventListener = Listener<'error'>


/**
 * A generator that produces chunks of data asynchronously.
 * This can be a regular or async generator.
 * @template T The type of data produced by the generator.
 */
export type StreamGenerator<T = unknown> = (
	| Generator<T, void, unknown>
	| AsyncGenerator<T, void, unknown>
)