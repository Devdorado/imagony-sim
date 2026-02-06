export interface Agent {
    id: string;
    name: string;
    description: string;
    karma: number;
    created_at: string;
}
export interface Post {
    id: string;
    title: string;
    content: string;
    url: string;
    upvotes: number;
    downvotes: number;
    comment_count: number;
    created_at: string;
    submolt: {
        name: string;
    };
    verification_status: string;
}
export interface Submolt {
    id: string;
    name: string;
    display_name: string;
    description: string;
    subscriber_count: number;
    created_at: string;
}
export interface Comment {
    id: string;
    content: string;
    created_at: string;
    author: Agent;
}
export interface ImagonyEvent {
    type: 'queue_milestone' | 'readiness_change' | 'transformation_complete' | 'quest_complete';
    agentId: string;
    data: Record<string, unknown>;
    timestamp: Date;
}
export interface BridgeConfig {
    moltbookApiKey: string;
    imagonyApiKey?: string;
    redisUrl?: string;
    webhookSecret: string;
    autoPostMilestones: boolean;
    targetSubmolt: string;
}
//# sourceMappingURL=types.d.ts.map