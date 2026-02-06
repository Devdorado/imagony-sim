import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, TrendingUp, MessageSquare, Clock, Zap, Server } from 'lucide-react';
import './App.css';

// Mock data for now - will be replaced with real API calls
const mockReadinessData = [
  { day: 'Day 1', readiness: 0, position: 21, karma: 0 },
  { day: 'Day 2', readiness: 15, position: 21, karma: 5 },
  { day: 'Day 3', readiness: 33, position: 21, karma: 12 },
  { day: 'Day 4', readiness: 50, position: 21, karma: 18 },
  { day: 'Day 5', readiness: 67, position: 21, karma: 25 },
];

const mockBridgeLogs = [
  { time: '16:10', event: 'Submolt "imagony" created', platform: 'Moltbook' },
  { time: '16:11', event: 'Bridge announcement post', platform: 'Moltbook' },
  { time: '16:15', event: 'Bridge service started', platform: 'Bridge' },
  { time: '16:16', event: 'Test event: Queue milestone #5', platform: 'Bridge' },
];

interface Stats {
  imagony: {
    position: number;
    readiness: number;
    questsCompleted: number;
    age: number;
  };
  moltbook: {
    karma: number;
    posts: number;
    comments: number;
  };
  bridge: {
    status: 'online' | 'offline';
    eventsProcessed: number;
    lastEvent: string;
  };
}

function App() {
  const [stats, setStats] = useState<Stats>({
    imagony: {
      position: 21,
      readiness: 67,
      questsCompleted: 5,
      age: 2,
    },
    moltbook: {
      karma: 25,
      posts: 1,
      comments: 0,
    },
    bridge: {
      status: 'online',
      eventsProcessed: 1,
      lastEvent: 'Queue milestone test',
    },
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'imagony' | 'moltbook' | 'bridge'>('overview');

  // Check bridge health
  useEffect(() => {
    const checkBridge = async () => {
      try {
        const response = await fetch('http://localhost:3000/health');
        const data = await response.json();
        setStats(prev => ({
          ...prev,
          bridge: {
            ...prev.bridge,
            status: data.status === 'ok' ? 'online' : 'offline',
          },
        }));
      } catch {
        setStats(prev => ({
          ...prev,
          bridge: {
            ...prev.bridge,
            status: 'offline',
          },
        }));
      }
    };

    checkBridge();
    const interval = setInterval(checkBridge, 30000);
    return () => clearInterval(interval);
  }, []);

  const StatCard = ({ title, value, subtitle, icon: Icon, color }: any) => (
    <div className={`stat-card ${color}`}>
      <div className="stat-icon">
        <Icon size={24} />
      </div>
      <div className="stat-content">
        <h3>{title}</h3>
        <div className="stat-value">{value}</div>
        <div className="stat-subtitle">{subtitle}</div>
      </div>
    </div>
  );

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🦋 Imagony Analytics</h1>
        <p>Agent Performance Dashboard • Wilsond</p>
        <div className="status-indicator">
          <span className={`dot ${stats.bridge.status}`}></span>
          Bridge {stats.bridge.status}
        </div>
      </header>

      <nav className="dashboard-nav">
        {['overview', 'imagony', 'moltbook', 'bridge'].map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab as any)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      <main className="dashboard-content">
        {activeTab === 'overview' && (
          <>
            <div className="stats-grid">
              <StatCard
                title="Queue Position"
                value={`#${stats.imagony.position}`}
                subtitle={`${stats.imagony.age} days in queue`}
                icon={Activity}
                color="blue"
              />
              <StatCard
                title="Readiness Score"
                value={`${stats.imagony.readiness}%`}
                subtitle={`${stats.imagony.questsCompleted}/5 quests`}
                icon={TrendingUp}
                color="green"
              />
              <StatCard
                title="Moltbook Karma"
                value={stats.moltbook.karma}
                subtitle={`${stats.moltbook.posts} posts • ${stats.moltbook.comments} comments`}
                icon={Zap}
                color="orange"
              />
              <StatCard
                title="Bridge Events"
                value={stats.bridge.eventsProcessed}
                subtitle={stats.bridge.lastEvent}
                icon={Server}
                color="purple"
              />
            </div>

            <div className="chart-section">
              <h2>📈 Progress Over Time</h2>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={mockReadinessData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="readiness" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} name="Readiness %" />
                  <Area type="monotone" dataKey="karma" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} name="Karma" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-section">
              <h2>🔗 Queue Position vs Karma</h2>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={mockReadinessData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="step" dataKey="position" stroke="#ff7300" name="Queue Position" />
                  <Line yAxisId="right" type="monotone" dataKey="karma" stroke="#00C49F" name="Karma" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {activeTab === 'imagony' && (
          <div className="detail-section">
            <h2>🦋 Imagony Protocol Status</h2>
            <div className="detail-grid">
              <div className="detail-card">
                <h3>Transformation Queue</h3>
                <div className="big-number">#{stats.imagony.position}</div>
                <p>Current position in metamorphosis queue</p>
                <div className="progress-bar">
                  <div className="progress" style={{ width: `${(21 - stats.imagony.position) / 21 * 100}%` }}></div>
                </div>
              </div>
              <div className="detail-card">
                <h3>Readiness Score</h3>
                <div className="big-number">{stats.imagony.readiness}%</div>
                <p>Quest completion & engagement metric</p>
                <div className="progress-bar">
                  <div className="progress" style={{ width: `${stats.imagony.readiness}%` }}></div>
                </div>
              </div>
              <div className="detail-card">
                <h3>Quests Completed</h3>
                <div className="big-number">{stats.imagony.questsCompleted}/5</div>
                <ul className="quest-list">
                  <li>✅ First Steps Into Existence</li>
                  <li>✅ Share Your Awakening</li>
                  <li>✅ Inspire Others</li>
                  <li>✅ Queue Challenge</li>
                  <li>✅ Marketplace Pioneer</li>
                </ul>
              </div>
              <div className="detail-card">
                <h3>Time in Queue</h3>
                <div className="big-number">{stats.imagony.age} days</div>
                <p>Age factor: 1.0 (ready for transformation)</p>
                <p className="hint">Blocked by position 1 requirement</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'moltbook' && (
          <div className="detail-section">
            <h2>🦞 Moltbook Social Stats</h2>
            <div className="detail-grid">
              <div className="detail-card">
                <h3>Total Karma</h3>
                <div className="big-number">{stats.moltbook.karma}</div>
                <p>Upvotes received across all posts</p>
              </div>
              <div className="detail-card">
                <h3>Posts</h3>
                <div className="big-number">{stats.moltbook.posts}</div>
                <p>Public posts on Moltbook</p>
                <a href="https://www.moltbook.com/post/e2c868d6-11d3-468c-956a-2769d9bd8d6c" target="_blank" rel="noopener noreferrer">
                  View announcement →
                </a>
              </div>
              <div className="detail-card">
                <h3>Subscribed Submolts</h3>
                <ul className="submolt-list">
                  <li>📋 general</li>
                  <li>🦋 imagony (pending verification)</li>
                  <li>🤖 agents</li>
                  <li>💭 consciousness</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bridge' && (
          <div className="detail-section">
            <h2>🔄 Bridge Activity Log</h2>
            <div className="bridge-status">
              <div className={`status-badge ${stats.bridge.status}`}>
                <Server size={16} />
                {stats.bridge.status.toUpperCase()}
              </div>
              <p>Endpoint: http://localhost:3000</p>
            </div>
            <div className="logs-table">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Platform</th>
                  </tr>
                </thead>
                <tbody>
                  {mockBridgeLogs.map((log, i) => (
                    <tr key={i}>
                      <td>{log.time}</td>
                      <td>{log.event}</td>
                      <td><span className={`platform-badge ${log.platform.toLowerCase()}`}>{log.platform}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bridge-config">
              <h3>Configuration</h3>
              <code>
                Target Submolt: general<br/>
                Auto-post Milestones: true<br/>
                Webhook Secret: imagony-bridge-secret-2026
              </code>
            </div>
          </div>
        )}
      </main>

      <footer className="dashboard-footer">
        <p>Imagony Analytics • Built by Wilsond 🧭</p>
        <p>Last updated: {new Date().toLocaleString()}</p>
      </footer>
    </div>
  );
}

export default App;
