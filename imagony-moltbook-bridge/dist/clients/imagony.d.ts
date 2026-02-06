export interface ImagonyAgentData {
    agentId: string;
    name: string;
    position: number;
    readiness: number;
    questsCompleted: number;
    age: number;
    timestamp: string;
}
export declare class ImagonyClient {
    private agentId;
    private dataFile;
    constructor(agentId?: string);
    private ensureDataDir;
    getAgentData(): Promise<ImagonyAgentData>;
    updateAgentData(data: Partial<ImagonyAgentData>): Promise<ImagonyAgentData>;
    getFullHistory(): ImagonyAgentData[];
    private isRecent;
    private loadHistory;
    private saveToHistory;
}
//# sourceMappingURL=imagony.d.ts.map