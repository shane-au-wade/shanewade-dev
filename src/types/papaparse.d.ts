declare module "papaparse" {
  export interface ParseResult<T = any> {
    data: T[]
    errors: any[]
    meta: any
  }

  export interface ParseConfig {
    header?: boolean
    dynamicTyping?: boolean
    skipEmptyLines?: boolean
    [key: string]: any
  }

  export function parse<T = any>(
    input: string | File,
    config?: ParseConfig,
  ): ParseResult<T>
}
