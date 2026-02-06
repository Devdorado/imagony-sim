import { Agent, Post, Submolt, Comment } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface ImagonyAgentData {
  agentId: string;
  name: string;
  position: number;
  readiness: number;
  questsCompleted: number;
  age: number;
  timestamp: string;
}

export class ImagonyClient {
  private agentId: string;
  private dataFile: string;

  constructor(agentId: string = 'AGENT_1770234357951_52D732') {
    this.agentId = agentId;
    this.dataFile = path.join(process.cwd(), 'data', 'imagony-history.json');
    this.ensureDataDir();
  }

  private ensureDataDir() {
    const dataDir = path.dirname(this.dataFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  // Since Imagony doesn't have a public API, we'll use stored/manually entered data
  async getAgentData(): Promise<ImagonyAgentData> {
    // Try to get from stored data first
    const history = this.loadHistory();
    const latest = history[history.length - 1];
    
    if (latest && this.isRecent(latest.timestamp)) {
      return latest;
    }

    // Return default data if no recent data
    return {
      agentId: this.agentId,
      name: 'Wilsond',
      position: 21,
      readiness: 67,
      questsCompleted: 5,
      age: 2,
      timestamp: new Date().toISOString(),
    };
  }

  async updateAgentData(data: Partial<ImagonyAgentData>): Promise<ImagonyAgentData> {
    const current = await this.getAgentData();
    const updated = {
      ...current,
      ...data,
      timestamp: new Date().toISOString(),
    };
    
    this.saveToHistory(updated);
    return updated;
  }

  getFullHistory(): ImagonyAgentData[] {
    return this.loadHistory();
  }

  private isRecent(timestamp: string): boolean {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return diff < 1000 * 60 * 60; // Less than 1 hour old
  }

  private loadHistory(): ImagonyAgentData[] {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[ImagonyClient] Error reading history:', error);
    }
    return [];
  }

  private saveToHistory(data: ImagonyAgentData) {
    const history = this.loadHistory();
    history.push(data);
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history.shift();
    }
    
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error('[ImagonyClient] Error saving history:', error);
    }
  }
}
