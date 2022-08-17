import { Controller } from "../../controller";
import { MyBot, MyContext } from "../../declarations";
import { Markup } from "telegraf";
import { commands } from "./commands";
import axios from "axios"

export default function (bot: MyBot) {
  const common = new Controller<MyContext>();

  const dayNow = new Date().getDate();
  const monthNow = new Date().getMonth() + 1;
  const yearNow = new Date().getFullYear();
  
  const markup = Markup.inlineKeyboard([
    Markup.button.callback("Начать копить!", "start"),
  ]);

  common.start(async (ctx, next) => {
    await ctx.reply("Стратегия накопления в один год", markup);
    return next();
  });

  common.on("text", (ctx, next) => {
    const { text } = ctx.message;
    if (
      text.includes("/start") ||
      text.includes("/time") ||
      text.includes("/help")
    )
      return next();
    if (!parseInt(text)) {
      if (!ctx.session?.begin || !ctx.session?.end)
        ctx.reply(`Начните с комманды /start и нажмите кнопку "Начать копить"`);
      else
        ctx.reply(
          `Введите целое число от ${ctx.session?.begin} до ${ctx.session?.end}`
        );
    } else {
      if (
        Number(text) < ctx.session?.begin ||
        Number(text) > ctx.session?.end
      ) {
        ctx.reply(
          `Введите целое число от ${ctx.session?.begin} до ${ctx.session?.end}`
        );
        return next();
      }

      ctx.session.topUpAmount = text != undefined ? Number(text) : null;

      ctx.reply(
        `Вы пополнили счет на ${text}?`,
        Markup.inlineKeyboard([
          Markup.button.callback("Да!", "Yes"),
          Markup.button.callback("Нет(", "No"),
        ])
      );
    }
    return next();
  });

// set time of notification
  const arrMarkUpTime = [9, 12, 15, 18, 21].map((time) =>
    Markup.button.callback(`${time}:00`, `${time}`)
  );
  const markupTime = Markup.inlineKeyboard(arrMarkUpTime);

  common.command("time", async (ctx, next) => {
    await ctx.reply("Установите время уведомления!", markupTime);
  });

  common.action("start", async (ctx, next) => {
    ctx.session = {
      begin: 1,
      end: 365,
    };
    let summStrategy: number = 0;
    for (let i = 1; i <= 365; ++i) {
      summStrategy += i;
    }
    try {
      // const userAmounts = await axios.get(`/user`, params: {ID: ctx.from?.id })
      // console.log(userAmounts)
    } catch (error) {
    }

    await ctx.reply(
      `Сумма к ${dayNow}.${monthNow}.${
        yearNow + 1
      } составит ${summStrategy}, если будете придерживаться стратегии.\nВведите сумму для пополнения от ${
        ctx.session?.begin
      } до ${ctx.session?.end}`
    );
    ctx.answerCbQuery();
    return next();
  });

  common.action("Yes", async (ctx, next) => {

    try {
      // const responseByAmount = await axios.post(`/user`, params: {ID: ctx.from?.id, TOPUP: ctx.session?.topUpAmount })
      // console.log(responseByAmount)

      // TODO: Сделать счетчик до следующего дня, сбрасывать в 12:00 AM
    } catch (error) {
    }

    // if(responseByAmount.status && !responseByAmount.isNoAmount) {
        ctx.reply(`Запомнил что пополнили на ${ctx.session?.topUpAmount}`)
    // } else {
    //  ctx.reply(`Выберите другую сумму для пополнения, на эту сумму уже пополняли.`)
    // }

    ctx.answerCbQuery();
    return next()
  });

  common.action("No", async (ctx, next) => {
    ctx.reply(`Введите целое число от ${ctx.session?.begin} до ${ctx.session?.end}`)
    ctx.answerCbQuery();
    return next()
  });

  common.help((ctx) => ctx.reply(commands.text));

  bot.use(common);
}
