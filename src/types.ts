/**
 * Event types emitted by the StreamReader.
 * @template T The type of data being read from the stream.
 */
export type StreamReaderEvents<T = unknown> = {
	/**
	 * Emitted when a chunk of data is read from the stream.
	 * @param {T | Awaited<T>} chunk - The chunk of data read from the stream.
	 */
	read: [ T | Awaited<T> ]


	/**
	 * Emitted when the stream is closed.
	 * @param {Awaited<T>[]} chunks - An array of chunks read from the stream before it was closed.
	 */
	close: [ Awaited<T>[] ]


	/**
	 * Emitted when an error occurs during reading.
	 * @param {Error} error - The error that occurred during the reading process.
	 */
	error: [ Error ]
}


/**
 * A listener function for events emitted by the StreamReader.
 * 
 * @template K The event type to listen for.
 * @template T The type of data being read from the stream.
 * @param {...StreamReaderEvents<T>[ K ]} args - The arguments emitted with the event.
 */
export type Listener<
	K extends keyof StreamReaderEvents,
	T = unknown
> = ( ...args: StreamReaderEvents<T>[ K ] ) => void


/**
 * Listener for the "read" event.
 * 
 * @template T The type of data being read.
 * @param {T | Awaited<T>} chunk - The chunk of data that was read.
 */
export type OnReadEventListener<T = unknown> = Listener<'read', T>


/**
 * Listener for the "close" event.
 * 
 * @template T The type of data being read.
 * @param {Awaited<T>[]} chunks - An array of chunks read before the stream was closed.
 */
export type OnCloseEventListener<T = unknown> = Listener<'close', T>


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