import { Context } from "telegraf"
import { Telegraf } from "./telegraf"


interface SessionData {
  begin: number,
  end: number,
  topUpAmount?: number | null
}

export interface MyContext extends Context {
  state: object,
  session: SessionData,
}
export type MyBot = Telegraf<MyContext>
