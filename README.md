# Galbe JWT Plugin

JWT plugin for [Galbe](https://galbe.dev/) framework.

# Install

```bash
bun add galbe-jwt
```

# Usage

## Example

```ts
import { Galbe } from "galbe"
import { plugin, hook } from "galbe-jwt"
import { importSPKI } from "jose"
import spki from "../res/public_key.pem" with {type:"text"}

const galbe = new Galbe()
const jwt = hook({
  publicKey: await importSPKI(spki, "RS256"),
  stateHolder: 'jwtPayload',
  validate: (payload) => true,
  errorHandler: () => new Response("", { status: 401 })
})

galbe.use(plugin)

galbe.get("/test", [jwt()], ctx => {
  let payload = ctx.state.jwtPayload
})

export default galbe
```

## Hook config

**publicKey** (KeyLike | Uint8Array): Public key used to verify JWT.

**stateHolder** (string): The name of the state variable that will hold the JWT payload. Default is `jwtPayload`.

**validate** ((payload: JWTPayload) => boolean): A custom function to validate the JWT payload. If the function returns `false`, a `JwtValidationError` is thrown. Default is `() => true`.

**errorHandler** ((error: Error) => Response): A callback to handle the JWT validation error. if the function returns a `Response`, it will be returned as the response. Default is `() => new Response("", { status: 401 })`.
