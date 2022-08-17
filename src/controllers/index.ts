import { MyBot } from "../declarations"
import commonController from "./common"

export default function (bot: MyBot) {
  bot.configure(commonController)
}
