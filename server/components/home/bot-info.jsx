import { BotConfig } from "./bot-config.jsx";
import { BotItem } from "./bot-item.jsx";
import { BotNetwork } from "./bot-network.jsx";

export default function BotInfo() {

    return (
        <div className="container mx-auto p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 机器人信息卡片 */ }
                <BotItem />
                <BotNetwork />
                <BotConfig />
            </div>
        </div>
    )
}
