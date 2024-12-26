import { StreamReader } from '@/index'
import { OnAbortEventListener, OnCloseEventListener, OnErrorEventListener, OnReadEventListener } from '@/types'

const sleep = ( ms: number ) => new Promise<void>( resolve => setTimeout( resolve, ms ) )

describe( 'StreamReader', () => {

	const streamData = async ( writer: WritableStreamDefaultWriter<Buffer>, error?: boolean ) => {
		await writer.write( Buffer.from( 'data 1' ) )
		await sleep( 50 )
		if ( error ) {
			throw new Error( 'Test Error' )
		}
		await writer.write( Buffer.from( 'data 2' ) )
		await writer.close()
		writer.releaseLock()
	}

	afterEach( () => {
		jest.restoreAllMocks()
	} )


	it( 'emit \'read\' Event when chunk is received', async () => {

		const stream	= new TransformStream<Buffer, Buffer>()
		const writer	= stream.writable.getWriter()
		const reader	= new StreamReader( stream.readable )

		streamData( writer )

		const onRead: OnReadEventListener<Buffer> = jest.fn()
		reader.on( 'read', onRead )
		await reader.read()
		
		expect( onRead ).toHaveBeenCalledTimes( 2 )
		expect( onRead ).toHaveBeenCalledWith( expect.any( Buffer ) )
	} )

	
	it( 'emit \'close\' Event when stream writer get closed', async () => {

		const stream	= new TransformStream<Buffer, Buffer>()
		const writer	= stream.writable.getWriter()
		const reader	= new StreamReader( stream.readable )

		streamData( writer )
	
		const onClose: OnCloseEventListener = jest.fn()
		reader.on( 'close', onClose )
		
		await reader.read()

		expect( onClose ).toHaveBeenCalledTimes( 1 )
		expect( onClose ).toHaveBeenCalledWith( expect.any( Array ) )		
	} )


	it( 'skips \'close\' when already closed', async () => {
		const stream	= new TransformStream<Buffer, Buffer>()
		const writer	= stream.writable.getWriter()
		const reader	= new StreamReader( stream.readable )

		streamData( writer )
	
		const onClose: OnCloseEventListener = jest.fn()
		reader.on( 'close', onClose )

		await reader.read()

		reader.close()
		reader.close()

		expect( onClose ).toHaveBeenCalledTimes( 1 )
		expect( onClose ).toHaveBeenCalledWith( expect.any( Array ) )		

	} )


	it( 'removes \'read\' and \'close\' listeners on close', async () => {
		const stream	= new TransformStream<Buffer, Buffer>()
		const writer	= stream.writable.getWriter()
		const reader	= new StreamReader( stream.readable )

		streamData( writer )
	
		const onRead: OnReadEventListener = jest.fn()
		const onClose: OnCloseEventListener = jest.fn()
		reader.on( 'read', onRead )
		reader.on( 'close', onClose )
		
		await reader.read()
	
		expect( reader.listenerCount( 'read' ) ).toBe( 0 )
		expect( reader.listenerCount( 'close' ) ).toBe( 0 )
	} )


	it( 'emit \'error\' Event when an Error occures', async () => {
		const stream	= new TransformStream<Buffer, Buffer>()
		const writer	= stream.writable.getWriter()
		const reader	= new StreamReader( stream.readable )

		streamData( writer, true )
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

		streamData( writer )

		await reader.read()
		await expect( reader.read() )
			.rejects.toThrow( 'Invalid state: The reader is not attached to a stream' )
	} )


	it( 'removes \'read\' and \'close\' listeners when Error occures', async () => {
		const stream	= new TransformStream<Buffer, Buffer>()
		const writer	= stream.writable.getWriter()
		const reader	= new StreamReader( stream.readable )

		streamData( writer, true )
			.catch( error => {
				writer.abort( error )
			} )
	
		const onRead: OnReadEventListener = jest.fn()
		const onClose: OnCloseEventListener = jest.fn()
		reader.on( 'read', onRead )
		reader.on( 'close', onClose )
		
		const onRead2: OnReadEventListener<Buffer> = jest.fn()
		const onClose2: OnCloseEventListener<Buffer> = jest.fn()
		reader.on( 'read', onRead )
		reader.on( 'close', onClose2 )		
		
		try {
			await reader.read()
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		} catch ( error ) {
			//
		}

		expect( onRead2 ).toHaveBeenCalledTimes( 0 )
		expect( onClose2 ).toHaveBeenCalledTimes( 0 )
		expect( reader.listenerCount( 'read' ) ).toBe( 0 )
		expect( reader.listenerCount( 'close' ) ).toBe( 0 )
	} )


	describe( 'StreamReader.read()', () => {
		it( 'returns a Promise with an Array of streamed chunks', async () => {
	
			const stream		= new TransformStream<Buffer, Buffer>()
			const writer		= stream.writable.getWriter()
			const streamReader	= new StreamReader( stream.readable )
	
			streamData( writer )

			const dataRead = streamReader.read()
			expect( dataRead ).toBeInstanceOf( Promise )

			const finalChunks = (
				( await dataRead )
					.map( chunk => Buffer.from( chunk ).toString() )
			)
			
			expect( finalChunks ).toBeInstanceOf( Array )
			expect( finalChunks ).toEqual( [ 'data 1', 'data 2' ] )
		} )
	} )


	describe( 'StreamReader.abort()', () => {

		it( 'allows to abort the reader before stream get closed', async () => {

			const stream	= new TransformStream<Buffer, Buffer>()
			const writer	= stream.writable.getWriter()
			const reader	= new StreamReader( stream.readable )
			
			const streamPromise = streamData( writer )
			
			setTimeout( () => {
				reader.abort( 'User aborted the data reading.' )
			}, 30 )
			

			const finalChunks = (
				( await reader.read() )
					.map( chunk => Buffer.from( chunk ).toString() )
			)
			
			expect( finalChunks ).toEqual( [ 'data 1' ] )
			await expect( streamPromise ).rejects.toThrow( 'User aborted the data reading.' )
		} )

		
		it( 'emit \'abort\' Event when the reader aborts', async () => {
			const stream	= new TransformStream<Buffer, Buffer>()
			const writer	= stream.writable.getWriter()
			const reader	= new StreamReader( stream.readable )


			streamData( writer )
				.catch( () => {
					writer.releaseLock()
				} )

			const onAbort: OnAbortEventListener = jest.fn()
			reader.on( 'abort', onAbort )
			
			setTimeout( () => {
				reader.abort( 'User aborted the data reading.' )
			}, 30 )
			
			await reader.read()
			expect( onAbort ).toHaveBeenCalledTimes( 1 )
			expect( onAbort ).toHaveBeenCalledWith( expect.any( DOMException ) )
		} )


		it( 'skips abort if already closed', async () => {
			const stream	= new TransformStream<Buffer, Buffer>()
			const writer	= stream.writable.getWriter()
			const reader	= new StreamReader( stream.readable )


			streamData( writer )
				.catch( () => {
					writer.releaseLock()
				} )

			const onAbort: OnAbortEventListener = jest.fn()
			reader.on( 'abort', onAbort )
			reader.on( 'error', () => {
				// expected error since we're closing before aborting (Invalid state: Releasing reader).
			} )
			
			setTimeout( async () => {
				await reader.close()
				reader.abort( 'User aborted the data reading.' )
			}, 30 )
			
			await reader.read()
			expect( onAbort ).toHaveBeenCalledTimes( 0 )
		} )


		it( 'aborts the reader with a default reason message', async () => {
			const stream	= new TransformStream<Buffer, Buffer>()
			const writer	= stream.writable.getWriter()
			const reader	= new StreamReader( stream.readable )

			const streamPromise = streamData( writer )

			const onAbort: OnAbortEventListener = jest.fn()
			reader.on( 'abort', onAbort )
			
			setTimeout( async () => {
				reader.abort()
			}, 30 )
			
			await reader.read()
			await expect( streamPromise ).rejects.toThrow( 'Streming reader aborted.' )
		} )

	} )


	describe( 'StreamReader.generatorToReadableStream()', () => {
		it( 'converts a Generator into a ReadableStream', async () => {

			async function* makeGenerator( encoder: TextEncoder )
			{
				yield encoder.encode( 'data 1' )
				await sleep( 500 )
				yield encoder.encode( 'data 2' )
			}

			const encoder	= new TextEncoder()
			const iterator	= makeGenerator( encoder )
			const stream	= StreamReader.generatorToReadableStream( iterator )
			const reader	= new StreamReader( stream )
			const dataRead	= reader.read()
			
			expect( stream ).toBeInstanceOf( ReadableStream )
			expect( dataRead ).toBeInstanceOf( Promise )

			const finalChunks = (
				( await dataRead )
					.map( chunk => Buffer.from( chunk ).toString() )
			)			
			
			expect( finalChunks ).toBeInstanceOf( Array )
			expect( finalChunks ).toEqual( [ 'data 1', 'data 2' ] )

		} )
	} )

} )