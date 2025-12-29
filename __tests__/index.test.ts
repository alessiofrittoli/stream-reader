import { Exception } from '@alessiofrittoli/exception'
import { ErrorCode } from '@alessiofrittoli/exception/code'

import { StreamReader } from '@/index'
import type {
	OnCancelEventListener,
	OnCloseEventListener,
	OnErrorEventListener,
	OnDataEventListener,
	OnAbortEventListener
} from '@/types'

const sleep = ( ms: number ) => new Promise<void>( resolve => setTimeout( resolve, ms ) )

describe( 'StreamReader', () => {

	const errorChunk	= new Exception( 'Test Error', { code: ErrorCode.QUOTA_REACHED } )
	const defaultChunks = [ 'data 1', 'data 2' ]
	const erroredChunks = [ 'data 1', errorChunk, 'data 2' ]
	
	const streamData = async (
		{ writer, chunks }: {
			writer: WritableStreamDefaultWriter<Buffer>
			chunks?: ( string | Error )[]
		}
	) => {
		chunks ||= defaultChunks
		for await ( const chunk of chunks ) {
			if ( chunk instanceof Error ) throw chunk
			await writer.write( Buffer.from( chunk ) )
			await sleep( 50 )
		}
		await writer.close()
		writer.releaseLock()
	}

	afterEach( () => {
		jest.restoreAllMocks()
	} )


	it( 'emit \'data\' Event when chunk is received', async () => {

		const stream	= new TransformStream<Buffer, Buffer>()
		const writer	= stream.writable.getWriter()
		const reader	= new StreamReader( stream.readable )

		streamData( { writer } )

		const onRead: OnDataEventListener<Buffer> = jest.fn()
		reader.on( 'data', onRead )
		await reader.read()
		
		expect( onRead ).toHaveBeenCalledTimes( 2 )
		expect( onRead ).toHaveBeenCalledWith( expect.any( Buffer ) )

	} )


	it( 'allows chunk by chunk transformation', async () => {

		const stream	= new TransformStream<Buffer, Buffer>()
		const writer	= stream.writable.getWriter()
		const reader	= new StreamReader<Buffer, string>( stream.readable, {
			transform: String,
		} )

		streamData( { writer } )

		reader.on( 'data', chunk => {
			// expect `StreamReader.on( 'data' ) to received transformed chunks.
			expect( typeof chunk ).toBe( 'string' )
		} )

		const dataRead = reader.read()

		await expect( dataRead ).resolves.toBeInstanceOf( Array )
		
		const chunks = ( await dataRead ).map( chunk => {
			expect( typeof chunk ).toBe( 'string' )
			return chunk
		} )
		expect( chunks ).toEqual( defaultChunks )

	} )


	it( 'emit \'close\' Event when stream writer get closed', async () => {

		const stream	= new TransformStream<Buffer, Buffer>()
		const writer	= stream.writable.getWriter()
		const reader	= new StreamReader( stream.readable )

		streamData( { writer } )
	
		const onClose: OnCloseEventListener<Buffer> = jest.fn()
		reader.on( 'close', onClose )
		
		await reader.read()

		expect( onClose ).toHaveBeenCalledTimes( 1 )
		expect( onClose ).toHaveBeenCalledWith( expect.any( Array ) )

	} )


	it( 'skips \'close\' when already closed', async () => {

		const stream	= new TransformStream<Buffer, Buffer>()
		const writer	= stream.writable.getWriter()
		const reader	= new StreamReader( stream.readable )

		streamData( { writer } )
	
		const onClose: OnCloseEventListener = jest.fn()
		reader.on( 'close', onClose )

		await reader.read()

		reader[ 'close' ]()
		reader[ 'close' ]()

		expect( onClose ).toHaveBeenCalledTimes( 1 )
		expect( onClose ).toHaveBeenCalledWith( expect.any( Array ) )

	} )


	it( 'removes \'data\' and \'close\' listeners on close', async () => {

		const stream	= new TransformStream<Buffer, Buffer>()
		const writer	= stream.writable.getWriter()
		const reader	= new StreamReader( stream.readable )

		streamData( { writer } )
	
		const onRead: OnDataEventListener<Buffer> = jest.fn()
		const onClose: OnCloseEventListener<Buffer> = jest.fn()
		reader.on( 'data', onRead )
		reader.on( 'close', onClose )
		
		await reader.read()
	
		expect( reader.listenerCount( 'data' ) ).toBe( 0 )
		expect( reader.listenerCount( 'close' ) ).toBe( 0 )

	} )


	it( 'emit \'error\' Event when an Error occures', async () => {

		const stream	= new TransformStream<Buffer, Buffer>()
		const writer	= stream.writable.getWriter()
		const reader	= new StreamReader( stream.readable )

		streamData( { writer, chunks: erroredChunks } )
			.catch( error => {
				writer.abort( error )
			} )
		
		const onError: OnErrorEventListener = jest.fn()
		reader.on( 'error', onError )
		
		await reader.read()
		expect( onError ).toHaveBeenCalledTimes( 1 )

	} )


	it( 'throws a new Error when no listener is attached to the \'error\' Event', async () => {

		const stream	= new TransformStream<Buffer, Buffer>()
		const writer	= stream.writable.getWriter()
		const reader	= new StreamReader( stream.readable )

		streamData( { writer } )

		await reader.read()
		await expect( () => reader.read() ) // call `StreamReader.read()` again to trigger error.
			.rejects.toThrow( 'Invalid state: The reader is not attached to a stream' )
		
	} )


	it( 'removes \'data\' and \'close\' listeners when Error occures', async () => {

		const stream	= new TransformStream<Buffer, Buffer>()
		const writer	= stream.writable.getWriter()
		const reader	= new StreamReader( stream.readable )

		streamData( { writer, chunks: erroredChunks } )
			.catch( error => {
				writer.abort( error )
			} )
	
		const onClose: OnCloseEventListener = jest.fn()
		reader.on( 'close', onClose )
		
		const onClose2: OnCloseEventListener<Buffer> = jest.fn()
		reader.on( 'close', onClose2 )

		await expect( () => reader.read() ).rejects.toThrow()

		expect( onClose ).toHaveBeenCalledTimes( 0 )
		expect( onClose2 ).toHaveBeenCalledTimes( 0 )
		expect( reader.listenerCount( 'data' ) ).toBe( 0 )
		expect( reader.listenerCount( 'close' ) ).toBe( 0 )

	} )


	describe( 'StreamReader.read()', () => {

		it( 'resolves a Promise with an Array of streamed chunks', async () => {

			const stream	= new TransformStream<Buffer, Buffer>()
			const writer	= stream.writable.getWriter()
			const reader	= new StreamReader( stream.readable )
	
			streamData( { writer } )

			const dataRead = reader.read()

			await expect( dataRead ).resolves.toBeInstanceOf( Array )
			
			const chunks = ( await dataRead ).map( chunk => {
				expect( chunk ).toBeInstanceOf( Buffer )
				return chunk.toString()
			} )

			expect( chunks ).toEqual( defaultChunks )

		} )


		it( 'doesn\'t collect in-memory chunks and returns void if `inMemory` option is set to `false`', async () => {

			const stream	= new TransformStream<Buffer, Buffer>()
			const writer	= stream.writable.getWriter()
			const reader	= new StreamReader( stream.readable, { inMemory: false } )
	
			streamData( { writer } )

			expect( await reader.read() ).toBeUndefined()


			const stream2	= new TransformStream<Buffer, Buffer>()
			const writer2	= stream2.writable.getWriter()
			const reader2	= new StreamReader( stream2.readable, { inMemory: false } )
	
			streamData( { writer: writer2, chunks: erroredChunks } )
				.catch( error => {
					writer2.abort( error )
				} )
			
			reader2.on( 'error', () => {} )
			expect( await reader2.read() ).toBeUndefined()

		} )
		
	} )


	describe( 'StreamReader.cancel()', () => {

		it( 'allows to cancel the reader before stream get closed', async () => {

			const stream	= new TransformStream<Buffer, Buffer>()
			const writer	= stream.writable.getWriter()
			const reader	= new StreamReader( stream.readable )
			
			const streamPromise = streamData( { writer } )
			
			reader.on( 'data', () => {
				// cancel when first chunk is read.
				reader.cancel( 'User cancelled the data reading.' )
			} )

			const dataRead = reader.read()

			const finalChunks = (
				( await dataRead )
					.map( chunk => Buffer.from( chunk ).toString() )
			)
			
			expect( finalChunks ).toEqual( [ defaultChunks.at( 0 ) ] )
			await expect( () => streamPromise ).rejects.toThrow( 'User cancelled the data reading.' )
			
		} )

		
		it( 'emit \'cancel\' Event when the reader get cancelled', async () => {

			const stream	= new TransformStream<Buffer, Buffer>()
			const writer	= stream.writable.getWriter()
			const reader	= new StreamReader( stream.readable )


			streamData( { writer } )
				.catch( () => {					
					writer.releaseLock()
				} )

			const onCancel: OnCancelEventListener = jest.fn()
			reader.on( 'cancel', onCancel )
			
			reader.on( 'data', () => {
				// cancel when first chunk is read.
				reader.cancel( 'User cancelled the data reading.' )
			} )
			
			await reader.read()
			expect( onCancel ).toHaveBeenCalledTimes( 1 )
			expect( onCancel ).toHaveBeenCalledWith( expect.any( DOMException ) )

		} )


		it( 'skips cancel if already closed', async () => {

			const stream	= new TransformStream<Buffer, Buffer>()
			const writer	= stream.writable.getWriter()
			const reader	= new StreamReader( stream.readable )

			streamData( { writer } )

			const onCancel: OnCancelEventListener = jest.fn()
			reader.on( 'cancel', onCancel )
			reader.on( 'close', () => reader.cancel( 'User cancelled the data reading.' ) )
						
			await reader.read()
			expect( onCancel ).toHaveBeenCalledTimes( 0 )

		} )


		it( 'cancel the reader with a default reason message', async () => {

			const stream	= new TransformStream<Buffer, Buffer>()
			const writer	= stream.writable.getWriter()
			const reader	= new StreamReader( stream.readable )

			const streamPromise = streamData( { writer } )

			const onCancel: OnCancelEventListener = jest.fn()
			reader.on( 'cancel', onCancel )
			
			reader.on( 'data', () => {
				// cancel when first chunk is read.
				reader.cancel()
			} )
			
			await reader.read()
			await expect( () => streamPromise ).rejects.toThrow( 'Streming reader cancelled.' )

		} )

	} )
	
	
	describe( 'StreamReader.abort()', () => {

		it( 'allows to cancel the reader before stream get closed', async () => {

			const stream	= new TransformStream<Buffer, Buffer>()
			const writer	= stream.writable.getWriter()
			const reader	= new StreamReader( stream.readable )
			
			const streamPromise = streamData( { writer } )
			
			reader.on( 'data', () => {
				reader.abort( 'User aborted the data reading.' )
			} )
			
			const dataRead = reader.read()

			const finalChunks = (
				( await dataRead )
					.map( chunk => Buffer.from( chunk ).toString() )
			)
			
			expect( finalChunks ).toEqual( [ defaultChunks.at( 0 ) ] )
			await expect( () => streamPromise )
				.rejects.toThrow(
					expect.objectContaining( {
						message	: 'User aborted the data reading.',
						code	: ErrorCode.ABORT,
					} )
				)

		} )

		
		it( 'emit \'abort\' Event when the reader get cancelled', async () => {

			const stream	= new TransformStream<Buffer, Buffer>()
			const writer	= stream.writable.getWriter()
			const reader	= new StreamReader( stream.readable )


			streamData( { writer } )
				.catch( () => {					
					writer.releaseLock()
				} )

			const onAbort: OnAbortEventListener = jest.fn()
			reader.on( 'abort', onAbort )
			
			reader.on( 'data', () => {
				reader.abort( 'User aborted the data reading.' )
			} )
			
			await reader.read()

			expect( onAbort ).toHaveBeenCalledTimes( 1 )
			expect( onAbort )
				.toHaveBeenCalledWith( expect.objectContaining( {
					message	: 'User aborted the data reading.',
					code	: ErrorCode.ABORT,
				} ) )

		} )


		it( 'cancel the reader with a default reason message', async () => {

			const stream	= new TransformStream<Buffer, Buffer>()
			const writer	= stream.writable.getWriter()
			const reader	= new StreamReader( stream.readable )
			const abortObj	= {
				message	: 'Streming reader aborted.',
				code	: ErrorCode.ABORT,
			}

			const streamPromise = streamData( { writer } )

			const onAbort: OnAbortEventListener = jest.fn()
			reader.on( 'abort', onAbort )
			
			reader.on( 'data', () => reader.abort() )
			
			await reader.read()
			await expect( () => streamPromise )
				.rejects.toThrow(
					expect.objectContaining( abortObj )
				)
			
			expect( onAbort )
				.toHaveBeenCalledWith( expect.objectContaining( abortObj ) )

		} )
		
		
		it( 'accepts custom AbortError options', async () => {
			
			const stream	= new TransformStream<Buffer, Buffer>()
			const writer	= stream.writable.getWriter()
			const reader	= new StreamReader( stream.readable )
			const abortObj	= {
				message	: 'Custom reason.',
				code	: ErrorCode.EXPIRED,
			}
		
			const streamPromise = streamData( { writer } )
		
			const onAbort: OnAbortEventListener = jest.fn()
			
			reader.on( 'abort', onAbort )
			reader.on( 'data', () => (
				reader.abort( 'Custom reason.', { code: ErrorCode.EXPIRED } )
			) )
			
			await reader.read()
			await expect( () => streamPromise )
				.rejects.toThrow( expect.objectContaining( abortObj ) )
	
			expect( onAbort )
				.toHaveBeenCalledWith( expect.objectContaining( abortObj ) )
		
		} )


		it( 'skips abort if already closed', async () => {

			const stream	= new TransformStream<Buffer, Buffer>()
			const writer	= stream.writable.getWriter()
			const reader	= new StreamReader( stream.readable )

			streamData( { writer } )

			const onAbort: OnAbortEventListener = jest.fn()
			reader.on( 'abort', onAbort )
						
			await reader.read()
			await reader.abort()
			expect( onAbort ).toHaveBeenCalledTimes( 0 )

		} )

	} )

	
	describe( 'StreamReader.generatorToReadableStream()', () => {

		it( 'converts a Generator into a ReadableStream', async () => {
			async function* makeGenerator( encoder: TextEncoder )
			{
				yield encoder.encode( defaultChunks.at( 0 ) )
				await sleep( 500 )
				yield encoder.encode( defaultChunks.at( 1 ) )
			}

			const encoder	= new TextEncoder()
			const iterator	= makeGenerator( encoder )
			const stream	= StreamReader.generatorToReadableStream( iterator )
			const reader	= new StreamReader( stream )
			const dataRead	= reader.read()

			expect( stream ).toBeInstanceOf( ReadableStream )
			await expect( dataRead ).resolves.toBeInstanceOf( Array )
			
			const chunks = ( await dataRead ).map( chunk => {
				expect( chunk ).toBeInstanceOf( Uint8Array )
				return Buffer.from( chunk ).toString()
			} )
			expect( chunks ).toEqual( defaultChunks )

		} )

	} )

} )