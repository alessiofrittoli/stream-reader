import { Readable } from 'stream'
import { extractBytesFromReadable } from '@/utils'

describe( 'extractBytesFromReadable', () => {

	it( 'extracts the exact number of bytes from a stream', async () => {

		const inputData			= Buffer.from( 'HelloWorld1234567890' )
		const inputStream		= Readable.from( inputData )
		const bytesToExtract	= 10

		const [ extracted, input ] = (
			await extractBytesFromReadable( inputStream, bytesToExtract )
		)
		
		expect( extracted ).toEqual( Buffer.from( 'HelloWorld' ) )

		const remaining: Buffer[] = []

		for await ( const chunk of input ) {
			remaining.push(chunk as Buffer)
		}

		expect( Buffer.concat( remaining ) )
			.toEqual( Buffer.from( '1234567890' ) )

	} )


	it( 'handles chunk boundaries correctly', async () => {

		// Simulate chunks that do not align with extraction size
		const chunks			= [ Buffer.from( 'abc' ), Buffer.from( 'defgh' ), Buffer.from( 'ijkl' ) ]
		const inputStream		= Readable.from(chunks)
		const bytesToExtract	= 7

		const [ extracted, input ] = (
			await extractBytesFromReadable( inputStream, bytesToExtract )
		)

		expect( extracted )
			.toEqual( Buffer.from( 'abcdefg' ) )

		const remaining: Buffer[] = []

		for await ( const chunk of input ) {
			remaining.push( chunk as Buffer )
		}

		expect( Buffer.concat( remaining ) )
			.toEqual( Buffer.from( 'hijkl' ) )

	} )


	it( 'rejects if the stream ends before enough bytes are read', async () => {

		const inputData			= Buffer.from( 'short' )
		const inputStream		= Readable.from( inputData )
		const bytesToExtract	= 10

		await expect( extractBytesFromReadable( inputStream, bytesToExtract ) )
			.rejects.toThrow(
				/less than the expected length/
			)

	} )


	it( 'propagates stream errors', async () => {

		const inputStream = new Readable( {
			read() {
				this.destroy( new Error( 'Stream error' ) )
			}
		} )

		const bytesToExtract = 5

		await expect( extractBytesFromReadable( inputStream, bytesToExtract ) )
			.rejects.toThrow( 'Stream error' )
		
	} )


	it( 'returns a Transform stream that can be piped further', async () => {

		const inputData			= Buffer.from( 'abcdefghij' )
		const inputStream		= Readable.from( inputData )
		const bytesToExtract	= 5

		const [ extracted, input ] = (
			await extractBytesFromReadable( inputStream, bytesToExtract )
		)
		expect( extracted )
			.toEqual( Buffer.from( 'abcde' ) )

		
		const output: Buffer[] = []
		input.on( 'data', chunk => output.push( chunk ) )
		
		await new Promise( resolve => input.on( 'end', resolve ) )
		
		expect( Buffer.concat( output ) )
			.toEqual( Buffer.from( 'fghij' ) )
		
	} )


	it( 'returns an empty Buffer if given `bytes` is set to less than or equal to 0', async () => {

		const inputData			= Buffer.from( '123456' )
		const inputStream		= Readable.from( inputData )
		const bytesToExtract	= -2

		const [ extracted ] = (
			await extractBytesFromReadable( inputStream, bytesToExtract )
		)
		
		expect( extracted )
			.toEqual( Buffer.alloc( 0 ) )

	} )

	return

} )