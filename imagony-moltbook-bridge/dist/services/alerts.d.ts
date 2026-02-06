export interface AlertConfig {
    discordWebhook?: string;
    telegramBotToken?: string;
    telegramChatId?: string;
    slackWebhook?: string;
}
export interface Alert {
    type: 'queue_milestone' | 'readiness_threshold' | 'position_change' | 'new_post' | 'mention';
    title: string;
    message: string;
    data: Record<string, unknown>;
    timestamp: Date;
}
export declare class AlertService {
    private config;
    private lastAlertTime;
    constructor(config: AlertConfig);
    sendAlert(alert: Alert): Promise<boolean>;
    private sendDiscord;
    private sendTelegram;
    private sendSlack;
    queueMilestone(position: number, readiness: number, age: number): Alert;
    readinessThreshold(readiness: number, previousReadiness: number): Alert;
    positionChange(oldPosition: number, newPosition: number): Alert;
    newPost(title: string, url: string, karma: number): Alert;
}
//# sourceMappingURL=alerts.d.ts.map