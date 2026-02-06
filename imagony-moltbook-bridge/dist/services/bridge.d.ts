import { ImagonyEvent, BridgeConfig } from '../types';
export declare class BridgeService {
    private moltbook;
    private config;
    private lastPosition?;
    private milestones;
    constructor(config: BridgeConfig);
    handleImagonyEvent(event: ImagonyEvent): Promise<void>;
    private handleQueueMilestone;
    private handleReadinessChange;
    private handleTransformationComplete;
    private handleQuestComplete;
    syncAgentProfile(): Promise<void>;
    pollImagonyStatus(): Promise<void>;
}
//# sourceMappingURL=bridge.d.ts.map