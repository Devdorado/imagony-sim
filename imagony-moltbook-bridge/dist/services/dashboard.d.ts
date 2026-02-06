import { ImagonyAgentData } from '../clients/imagony';
import { Agent, Post } from '../types';
export interface DashboardData {
    timestamp: string;
    imagony: {
        position: number;
        readiness: number;
        questsCompleted: number;
        age: number;
        history: ImagonyAgentData[];
    };
    moltbook: {
        karma: number;
        posts: number;
        comments: number;
        recentPosts: Post[];
        profile?: Agent;
    };
    bridge: {
        eventsProcessed: number;
        lastEvent: string;
        status: 'online' | 'offline';
    };
    correlation: {
        readinessKarmaRatio: number;
        trend: 'improving' | 'stable' | 'declining';
    };
}
export declare class DashboardService {
    private moltbook;
    private imagony;
    private eventCount;
    private lastEvent;
    constructor(moltbookApiKey: string, imagonyAgentId?: string);
    recordEvent(eventType: string): void;
    getDashboardData(): Promise<DashboardData>;
    updateImagonyData(data: Partial<ImagonyAgentData>): Promise<ImagonyAgentData>;
}
//# sourceMappingURL=dashboard.d.ts.map