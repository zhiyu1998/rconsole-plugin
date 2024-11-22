import React from 'react';
import BotInfo from "../home/bot-info.jsx";
import Network from "../home/network.jsx";
import System from "../home/system.jsx";

export default function Home({  }) {
    return (
        <div className="container mx-auto p-8">
            <BotInfo />
            <System />
            <Network />
        </div>
    );
}
