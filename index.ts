import {
  type Galbe,
  type Context,
  type GalbePlugin,
  $T,
  type Route,
} from "galbe"
import {
  jwtVerify,
  type JWTPayload,
  type JWTVerifyOptions,
  type KeyLike,
} from "jose"
import { walkRoutes } from "galbe/utils"

export interface HookConfig extends JWTVerifyOptions {
  /** Name of the state variable that holds the jwt payload. Default value is `jwtPayload` */
  stateHolder?: string
  /** Validates a JWT payload. If false is returned a JwtValidationError is thrown */
  validate?: (payload: JWTPayload) => boolean
  /** Catch errors during jwt verification and eventually return a custom Response */
  errorHandler?: (
    error: Error
  ) => Response | void | Promise<Response> | Promise<void>
}
export interface JwtConfig extends HookConfig {
  /** Key to verify the JWT with. See {@link https://github.com/panva/jose/issues/210#jws-alg Algorithm Key Requirements}. */
  publicKey: KeyLike | Uint8Array
}
export class JwtValidationError extends Error {
  constructor(message?: string) {
    super(message)
  }
}

const DEFAULT_HOOK_CONFIG = {
  stateHolder: "jwtPayload",
  validate: () => true,
  errorHandler: () => new Response("", { status: 401 }),
}

const hookInstances: Set<Function> = new Set()

export const hook = (jwtConfig: JwtConfig) => {
  const { publicKey } = jwtConfig
  const verify = async (jwt: string, options?: JWTVerifyOptions) => {
    const { payload } = await jwtVerify(jwt, publicKey, options)
    return payload
  }

  return (hookConfig?: HookConfig) => {
    let conf = { ...DEFAULT_HOOK_CONFIG, ...jwtConfig, ...hookConfig }
    let f = async (ctx: Context) => {
      const auth = ctx.headers.authorization as string
      const jwt = auth?.replace(/^Bearer\s+/, "")
      let payload = null
      try {
        payload = await verify(jwt, conf)
        if (!conf.validate(payload)) throw new JwtValidationError()
        ctx.state[conf.stateHolder] = payload
      } catch (error) {
        return await conf.errorHandler(error as Error)
      }
    }
    hookInstances.add(f)
    return f
  }
}
const operationsMap = new Map<string, Route>()
export const plugin = {
  name: "jwt",
  async init(_, galbe: Galbe) {
    const metaRoutes = galbe.meta?.reduce(
      (routes, c) => ({ ...routes, ...c.routes }),
      {} as Record<string, Record<string, Record<string, any>>>
    )
    walkRoutes(galbe.router.routes, (route) => {
      let meta = metaRoutes?.[route.path]?.[route.method]
      if (route.hooks?.some((h) => hookInstances.has(h))) {
        if (!route.schema.headers) route.schema.headers = {}
        let headerKeys = Object.keys(route.schema.headers).filter((h) =>
          h.match(/authorization/i)
        )
        if (!headerKeys.length) headerKeys = ["authorization"]
        for (let h of headerKeys) {
          route.schema.headers[h] = $T.optional(
            $T.string({
              pattern: /^Bearer /,
            })
          )
        }
        if (meta?.operationId) operationsMap.set(meta?.operationId, route)
      }
    })
  },
  async cli(commands) {
    commands.forEach((c) => {
      if (!operationsMap.has(c.name)) return
      c.action = (props) => {
        let jwt = props?.["%jwt"] || Bun.env.GCLI_JWT
        if (jwt) props["%header"].push(`authorization=Bearer ${jwt}`)
      }
      c.options?.push({
        name: "%jwt",
        short: "%j",
        type: "<string>",
        description: "JWT authentication token",
        default: "",
      })
    })
  },
} as GalbePlugin
