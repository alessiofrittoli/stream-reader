import { StreamReader } from '@/index'
import { OnCancelEventListener, OnCloseEventListener, OnErrorEventListener, OnReadEventListener } from '@/types'

const sleep = ( ms: number ) => new Promise<void>( resolve => setTimeout( resolve, ms ) )

describe( 'StreamReader', () => {

	const defaultChunks = [ 'data 1', 'data 2' ]
	const erroredChunks = [ 'data 1', new Error( 'Test Error' ), 'data 2' ]
	
	const streamData = async (
		{ writer, chunks }: {
			writer: WritableStreamDefaultWriter<Buffer>
			chunks?: ( string | Error )[]
		}
	) => {
		chunks ||= defaultChunks
		for await ( const chunk of chunks ) {
			if ( chunk instanceof Error ) {
				throw chunk
			}
			await writer.write( Buffer.from( chunk ) )
			await sleep( 50 )
		}
		// await writer.write( Buffer.from( 'data 1' ) )
		// await sleep( 50 )
		// if ( error ) {
		// 	throw new Error( 'Test Error' )
		// }
		// await writer.write( Buffer.from( 'data 2' ) )
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

		streamData( { writer } )

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


	it( 'removes \'read\' and \'close\' listeners on close', async () => {
		const stream	= new TransformStream<Buffer, Buffer>()
		const writer	= stream.writable.getWriter()
		const reader	= new StreamReader( stream.readable )

		streamData( { writer } )
	
		const onRead: OnReadEventListener<Buffer> = jest.fn()
		const onClose: OnCloseEventListener<Buffer> = jest.fn()
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
		await expect( reader.read() )
			.rejects.toThrow( 'Invalid state: The reader is not attached to a stream' )
	} )


	it( 'removes \'read\' and \'close\' listeners when Error occures', async () => {
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
		
		try {
			await reader.read()
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		} catch ( error ) {
			//
		}

		expect( onClose ).toHaveBeenCalledTimes( 0 )
		expect( onClose2 ).toHaveBeenCalledTimes( 0 )
		expect( reader.listenerCount( 'read' ) ).toBe( 0 )
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
	} )


	describe( 'StreamReader.cancel()', () => {

		it( 'allows to cancel the reader before stream get closed', async () => {

			const stream	= new TransformStream<Buffer, Buffer>()
			const writer	= stream.writable.getWriter()
			const reader	= new StreamReader( stream.readable )
			
			const streamPromise = streamData( { writer } )
			
			setTimeout( () => {
				reader.cancel( 'User cancelled the data reading.' )
			}, 30 )
			
			const dataRead = reader.read()

			const finalChunks = (
				( await dataRead )
					.map( chunk => Buffer.from( chunk ).toString() )
			)
			
			expect( finalChunks ).toEqual( [ defaultChunks.at( 0 ) ] )
			await expect( streamPromise ).rejects.toThrow( 'User cancelled the data reading.' )
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
			
			setTimeout( () => {
				reader.cancel( 'User cancelled the data reading.' )
			}, 40 )
			
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
			
			setTimeout( async () => {
				reader.cancel()
			}, 30 )
			
			await reader.read()
			await expect( streamPromise ).rejects.toThrow( 'Streming reader aborted.' )
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