# Stream Reader 📚

[![NPM Latest Version][version-badge]][npm-url] [![Coverage Status][coverage-badge]][coverage-url] [![Socket Status][socket-badge]][socket-url] [![NPM Monthly Downloads][downloads-badge]][npm-url] [![Dependencies][deps-badge]][deps-url]

[![GitHub Sponsor][sponsor-badge]][sponsor-url]

[version-badge]: https://img.shields.io/npm/v/%40alessiofrittoli%2Fstream-reader
[npm-url]: https://npmjs.org/package/%40alessiofrittoli%2Fstream-reader
[coverage-badge]: https://coveralls.io/repos/github/alessiofrittoli/stream-reader/badge.svg
[coverage-url]: https://coveralls.io/github/alessiofrittoli/stream-reader
[socket-badge]: https://socket.dev/api/badge/npm/package/@alessiofrittoli/stream-reader
[socket-url]: https://socket.dev/npm/package/@alessiofrittoli/stream-reader/overview
[downloads-badge]: https://img.shields.io/npm/dm/%40alessiofrittoli%2Fstream-reader.svg
[deps-badge]: https://img.shields.io/librariesio/release/npm/%40alessiofrittoli%2Fstream-reader
[deps-url]: https://libraries.io/npm/%40alessiofrittoli%2Fstream-reader

[sponsor-badge]: https://img.shields.io/static/v1?label=Fund%20this%20package&message=%E2%9D%A4&logo=GitHub&color=%23DB61A2
[sponsor-url]: https://github.com/sponsors/alessiofrittoli

## Easly read pushed data from a Stream

The `StreamReader` class is a utility for reading data from a `ReadableStream` in a structured and event-driven manner. It extends the `EventEmitter` class, providing events for stream lifecycle management and error handling.

### Table of Contents

- [Getting started](#getting-started)
- [API Reference](#api-reference)
  - [StreamReader Class API Reference](#streamreader-class-api-reference)
    - [Constructor](#constructor)
    - [Properties](#properties)
    - [Methods](#methods)
    - [Static Methods](#static-methods)
    - [Listening Event](#listening-events)
    - [Usage](#usage)
    - [Error handling](#error-handling)
  - [Types API Reference](#types-api-reference)
- [Development](#development)
  - [Install depenendencies](#install-depenendencies)
  - [Build the source code](#build-the-source-code)
  - [ESLint](#eslint)
  - [Jest](#jest)
- [Contributing](#contributing)
- [Security](#security)
- [Credits](#made-with-)

---

### Getting started

Run the following command to start using `stream-reader` in your projects:

```bash
npm i @alessiofrittoli/stream-reader
```

or using `pnpm`

```bash
pnpm i @alessiofrittoli/stream-reader
```

---

### API Reference

#### Importing the library

```ts
import { StreamReader } from '@alessiofrittoli/stream-reader'
import type { ... } from '@alessiofrittoli/stream-reader/types'
```

#### StreamReader Class API Reference

##### Constructor

The `StreamReader` class constructor accepts a `ReadableStream` argument. You can optionally pass types arguments `I` and `O` to define the type of the streamed data being read and the type of the transformed output chunk.

<details>

<summary>Example</summary>

```ts
const reader  = new StreamReader<Buffer>( ... )
const reader2 = new StreamReader<Buffer, string>( ... )
```

</details>

---

<details>

<summary>Automatically inferred type</summary>

```ts
type Input    = Buffer
type Output   = Buffer
const stream  = new TransformStream<Input, Output>()
const reader  = new StreamReader( stream.readable ) // type of `StreamReader<Output, Output>`
```

</details>

---

##### Properties

Here are listed the `StreamReader` class instance accessible properties:

<details>

<summary>Properties</summary>

| Parameter | Type                             | Description |
|-----------|----------------------------------|-------------|
| `reader`  | `ReadableStreamDefaultReader<T>` | The reader obtained from the input `ReadableStream<T>` |
| `closed`  | `boolean`                        | Indicates whether the stream has been closed. |

</details>

<details>

<summary>Type parameters</summary>

| Parameter | Default   | Description |
|-----------|-----------|-------------|
| `I`       | `unknown` | The type of input data being read from the stream. |
| `O`       | `I`       | The type of output data transformed after reading from the stream. Defaults to the same type of `I`. |

</details>

---

##### Methods

###### `StreamReader.read()`

The `StreamReader.read()` method read the on-demand pushed data from the given stream.

It internally uses the `StreamReader.readChunks()` method to read the received chunks.

It emits usefull events such as:

- `data` - Emitted when a chunk is received from the stream and processed by the optional transform function.
- `close` - Emitted when the stream is closed.
- `error` - Emitted when an error occurs while reading.

---

- See [Listening Events](#listening-events) section for further info.

<details>

<summary>Parameters</summary>

| Paramenter | Type | Description |
| `transform` | `TransformChunk<I, O>` | (Optional) A function that transforms each chunk. |

</details>

<details>

<summary>Returns</summary>

Type: `Promise<ReadChunks<O>>`

A new Promise with an Array of read and eventually transformed chunks, resolved once the stream is closed.

</details>

---

###### `StreamReader.readChunks()`

The `StreamReader.readChunks()` method read the on-demand pushed data from the given stream.

<details>

<summary>Returns</summary>

Type: `AsyncGenerator<ReadChunk<I>>`

An async iterable object for consuming chunks of data.

</details>

---

###### `StreamReader.cancel()`

The `StreamReader.cancel()` method it's pretty usefull when stream data reading is no longer needed, regardless of stream writer state.

This method will cancel the reader, release the lock, emit a 'cancel' event, and remove `data`, `close` and `cancel` event listeners.

It emits the `cancel` event.

- See [Listening Events](#listening-events) section for further info.

---

##### Static Methods

###### `StreamReader.generatorToReadableStream()`

The `StreamReader.generatorToReadableStream()` method is a utiliy function that converts a `Generator` or `AsyncGenerator` to a `ReadableStream`.

<details>

<summary>Parameters</summary>

| Parameter   | Type                 | Default                    | Description |
|-------------|----------------------|----------------------------|-------------|
| `generator` | `StreamGenerator<T>` | `StreamGenerator<unknown>` | The Generator or AsyncGenerator to convert. |

</details>

---

<details>

<summary>Type Parameters</summary>

| Parameter | Type | Default   | Description                                |
|-----------|------|-----------|--------------------------------------------|
| `T`       | `T`  | `unknown` | The type of data produced by the iterator. |

</details>

---

##### Listening Events

The `StreamReader` class extends the `EventEmitter` class, providing events for stream lifecycle management and error handling.

<details>

<summary>Events list</summary>

| Event    | Arguments | Type            | Description |
|----------|-----------|-----------------|-------------|
| `data`   |           |                 | Emitted when a chunk of data is read from the stream and processed by the optional `transform` function. |
|          | `chunk`   | `ReadChunk<O>`  | The chunk of data read from the stream. |
| `close`  |           |                 | Emitted when the stream is closed. |
|          | `chunks`  | `ReadChunks<O>` | An array of chunks read from the stream before it was closed. |
| `error`  |           |                 | Emitted when an error occurs during reading. |
|          | `error`   | `Error`         | The error that occurred during the reading process. |
| `cancel` |           |                 | Emitted when the reading process is canceled. |
|          | `reason`  | `DOMException`  | A DOMException explaing the reason for aborting the operation. |

</details>

---

<details>

<summary>Examples</summary>

###### `data` event

```ts
const reader = new StreamReader( ... )
reader.on( 'data', chunk => {
  console.log( 'received chunk', chunk )
} )
```

---

###### `close` event

```ts
const reader = new StreamReader( ... )
reader.on( 'close', chunks => {
  console.log( 'chunks', chunks )
} )
```

---

###### `error` event

```ts
const reader = new StreamReader( ... )
reader.on( 'error', error => {
  console.error( error )
} )
```

---

###### `cancel` event

```ts
const reader = new StreamReader( ... )
reader.on( 'cancel', reason => {
  console.log( 'reading cancelled', reason.message )
} )
```

</details>

---

##### Usage

In the following examples we reference `streamData` which is an async function that writes data and closes the stream once finished:

```ts
const sleep = ( ms: number ) => new Promise<void>( resolve => setTimeout( resolve, ms ) )

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
  await writer.close()
  writer.releaseLock()
}
```

<details>

<summary>Basic usage</summary>

```ts
const stream  = new TransformStream<Buffer, Buffer>()
const writer  = stream.writable.getWriter()
const reader  = new StreamReader( stream.readable )

streamData( { writer } )

const chunks = await reader.read()
```

</details>

---

<details>

<summary>Reading chunk by chunk from a Response Body</summary>

```ts
const response = await fetch( ... )
let resourceSize = 0

if ( response.body ) {
    const reader  = new StreamReader( response.body )
    const decoder = new TextDecoder()
    reader.on( 'data', chunk => {
        const decoded = decoder.decode( chunk, { stream: true } )
        resourceSize += chunk.BYTES_PER_ELEMENT * chunk.length
    } )
    const chunks = await reader.read()
}
```

</details>

---

<details>

<summary>Transforming read chunks</summary>

```ts
const stream  = new TransformStream<Buffer, Buffer>()
const writer  = stream.writable.getWriter()
const reader  = new StreamReader<Buffer, string>( stream.readable, {
  transform( chunk ) {
    return chunk.toString( 'base64url' )
  }
} )

streamData( { writer } )

reader.on( 'data', chunk => {
  console.log( chunk ) // chunk is now a base64url string
} )
const chunks = await reader.read() // `string[]`
```

</details>

---

<details>

<summary>Opting-out from in-memory chunk collection</summary>

```ts
const inMemory  = false
const stream    = new TransformStream<Buffer, Buffer>()
const writer    = stream.writable.getWriter()
const reader    = new StreamReader( stream.readable, { inMemory } )

streamData( { writer } )

reader.on( 'data', chunk => {
  console.log( chunk )
} )
const chunks = await reader.read() // empty `[]`
```

</details>

---

<details>

<summary>Cancelling the reader before Stream is closed</summary>

```ts
const stream  = new TransformStream<Buffer, Buffer>()
const writer  = stream.writable.getWriter()
const reader  = new StreamReader( stream.readable )

streamData( { writer } )

reader.read()

cancelButton.addEventListener( 'click', () => {
  reader.cancel( 'Reading no longer needed' )
} )
```

</details>

---

##### Error handling

When an error occurs while reading stream data (such as unexpected stream abort), the `StreamReader` uses an internal `error` function which handles the thrown Error.

By default, if no listener is attached to the `error` event, the `StreamReader.read()` method will re-throw the caught error.

In that case, you need to await and wrap the `StreamReader.read()` method call in a `trycatch` block like so:

```ts
try {
  const chunks = await reader.read()
} catch ( err ) {
  const error = err as Error
  console.error( 'An error occured', error.message )
}
```

with `error` event listener:

```ts
reader.read()
reader.on( 'error', error => {
  console.error( 'An error occured', error.message )
} )
```

---

#### Types API Reference

##### `ReadChunk<T>`

Represents a chunk of data that can be read, which can either be of type `T` or a promise that resolves to `T`.

- **Type Parameter:**
  - `T`: The type of the data chunk. Defaults to `unknown` if not specified.

---

##### `ReadChunks<T>`

Represents an array of `ReadChunk` objects.

- **Type Parameter:**
  - `T`: The type of data contained in each `ReadChunk`.

---

##### `TransformChunk<I, O>`

A function that transforms a chunk of data.

- **Type Parameters:**
  - `I`: The type of the input chunk. Defaults to `unknown`.
  - `O`: The type of the output chunk. Defaults to `I`.

- **Parameters:**
  - `chunk`: The chunk of data to be transformed.

- **Returns:**  
  A transformed chunk of data, which can be either a synchronous result or a promise that resolves to the result.

---

##### `StreamReaderEvents<O>`

Defines event types emitted by the `StreamReader`.

- **Type Parameter:**
  - `O`: The type of data being read from the stream and eventually transformed before the event is emitted.

- **Event Types:**
  - `data`: Emitted when a chunk of data is read.
    - **Parameters:** `chunk` (`ReadChunk<O>`)
  - `close`: Emitted when the stream is closed.
    - **Parameters:** `chunks` (`ReadChunks<O>`)
  - `error`: Emitted when an error occurs during reading.
    - **Parameters:** `error` (`Error`)
  - `cancel`: Emitted when the reading process is canceled.
    - **Parameters:** `reason` (`DOMException`)

---

##### `Listener<K, O>`

A listener function for events emitted by the `StreamReader`.

- **Type Parameters:**
  - `K`: The event type to listen for.
  - `O`: The type of data being read from the stream.

- **Parameters:**
  - `...args`: The arguments emitted with the event, based on the event type `K`.

---

##### `OnDataEventListener<O>`

Listener for the `data` event.

- **Type Parameter:**
  - `O`: The type of data being read.

- **Parameters:**
  - `chunk` (`ReadChunk<O>`): The chunk of data that was read.

---

##### `OnCloseEventListener<O>`

Listener for the `close` event.

- **Type Parameter:**
  - `O`: The type of data being read.

- **Parameters:**
  - `chunks` (`ReadChunks<O>`): An array of chunks read before the stream was closed.

---

##### `OnCancelEventListener`

Listener for the `cancel` event.

- **Parameters:**
  - `reason` (`DOMException`): Explains the reason for aborting the operation.

---

##### `OnErrorEventListener`

Listener for the `error` event.

- **Parameters:**
  - `error` (`Error`): The error that occurred during reading.

---

##### `StreamGenerator<T>`

A generator that produces chunks of data asynchronously. It can be either a regular generator or an async generator.

- **Type Parameter:**
  - `T`: The type of data produced by the generator.
  
---

### Development

#### Install depenendencies

```bash
npm install
```

or using `pnpm`

```bash
pnpm i
```

#### Build the source code

Run the following command to test and build code for distribution.

```bash
pnpm build
```

#### [ESLint](https://www.npmjs.com/package/eslint)

warnings / errors check.

```bash
pnpm lint
```

#### [Jest](https://npmjs.com/package/jest)

Run all the defined test suites by running the following:

```bash
# Run tests and watch file changes.
pnpm test:watch

# Run tests in a CI environment.
pnpm test:ci
```

You can eventually run specific suits like so:

- See [`package.json`](./package.json) file scripts for more info.

```bash
pnpm test:jest
```

Run tests with coverage.

An HTTP server is then started to serve coverage files from `./coverage` folder.

⚠️ You may see a blank page the first time you run this command. Simply refresh the browser to see the updates.

```bash
test:coverage:serve
```

---

### Contributing

Contributions are truly welcome!

Please refer to the [Contributing Doc](./CONTRIBUTING.md) for more information on how to start contributing to this project.

Help keep this project up to date with [GitHub Sponsor][sponsor-url].

[![GitHub Sponsor][sponsor-badge]][sponsor-url]

---

### Security

If you believe you have found a security vulnerability, we encourage you to **_responsibly disclose this and NOT open a public issue_**. We will investigate all legitimate reports. Email `security@alessiofrittoli.it` to disclose any security vulnerabilities.

### Made with ☕

<table style='display:flex;gap:20px;'>
  <tbody>
    <tr>
      <td>
        <img alt="avatar" src='https://avatars.githubusercontent.com/u/35973186' style='width:60px;border-radius:50%;object-fit:contain;'>
      </td>
      <td>
        <table style='display:flex;gap:2px;flex-direction:column;'>
          <tbody>
              <tr>
                <td>
                  <a href='https://github.com/alessiofrittoli' target='_blank' rel='noopener'>Alessio Frittoli</a>
                </td>
              </tr>
              <tr>
                <td>
                  <small>
                    <a href='https://alessiofrittoli.it' target='_blank' rel='noopener'>https://alessiofrittoli.it</a> |
                    <a href='mailto:info@alessiofrittoli.it' target='_blank' rel='noopener'>info@alessiofrittoli.it</a>
                  </small>
                </td>
              </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>
