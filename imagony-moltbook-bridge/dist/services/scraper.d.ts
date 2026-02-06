export interface ImagonyAgentData {
    agentId: string;
    name: string;
    position: number;
    readiness: number;
    questsCompleted: number;
    age: number;
    timestamp: string;
}
export declare class ImagonyScraper {
    private agentId;
    private apiKey;
    constructor(agentId?: string, apiKey?: string);
    scrapeAgentData(): Promise<ImagonyAgentData | null>;
    fetchFromApi(): Promise<ImagonyAgentData | null>;
}
//# sourceMappingURL=scraper.d.ts.map