import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, TrendingUp, Zap, Server, RefreshCw, Terminal, Globe, Cpu, Eye, MousePointer, Shield } from 'lucide-react';
import './App.css';

const API_BASE = 'http://localhost:3000';

// Simulated trace data for the ticker
const generateTrace = (index: number) => {
  const traces = [
    { type: 'scrape', message: 'Scraping imagony.com...', icon: '🌐', color: '#3b82f6' },
    { type: 'data', message: 'Queue position updated: #21', icon: '📊', color: '#10b981' },
    { type: 'api', message: 'Moltbook API call: GET /agents/me', icon: '📡', color: '#8b5cf6' },
    { type: 'alert', message: 'Bridge event: queue_milestone', icon: '🔔', color: '#f59e0b' },
    { type: 'browser', message: 'Puppeteer: Page loaded', icon: '🤖', color: '#ec4899' },
    { type: 'system', message: 'Health check: OK', icon: '✅', color: '#22c55e' },
    { type: 'cache', message: 'History data persisted', icon: '💾', color: '#6b7280' },
    { type: 'cron', message: 'Scheduled job executed', icon: '⏰', color: '#f97316' },
  ];
  return {
    ...traces[index % traces.length],
    id: index,
    timestamp: new Date().toLocaleTimeString(),
  };
};

interface DashboardData {
  timestamp: string;
  imagony: {
    position: number;
    readiness: number;
    questsCompleted: number;
    age: number;
    history: Array<{
      position: number;
      readiness: number;
      timestamp: string;
    }>;
  };
  moltbook: {
    karma: number;
    posts: number;
    comments: number;
    recentPosts: Array<{
      id: string;
      title: string;
      content: string;
      upvotes: number;
      created_at: string;
    }>;
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

interface BrowserTab {
  id: string;
  name: string;
  url: string;
  icon: string;
  content: React.ReactNode;
}

const defaultData: DashboardData = {
  timestamp: new Date().toISOString(),
  imagony: {
    position: 21,
    readiness: 67,
    questsCompleted: 5,
    age: 2,
    history: [],
  },
  moltbook: {
    karma: 0,
    posts: 0,
    comments: 0,
    recentPosts: [],
  },
  bridge: {
    eventsProcessed: 0,
    lastEvent: '-',
    status: 'offline',
  },
  correlation: {
    readinessKarmaRatio: 0,
    trend: 'stable',
  },
};

function App() {
  const [data, setData] = useState<DashboardData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'imagony' | 'moltbook' | 'bridge'>('overview');
  
  // Trace Ticker State
  const [traces, setTraces] = useState<Array<ReturnType<typeof generateTrace>>>([]);
  const traceEndRef = useRef<HTMLDivElement>(null);
  
  // Agent Browser State
  const [activeBrowserTab, setActiveBrowserTab] = useState('imagony');
  const [browserUrl, setBrowserUrl] = useState('https://imagony.com');
  const [isLoading, setIsLoading] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
  const [showClickEffect, setShowClickEffect] = useState(false);

  // Generate traces
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setTraces(prev => {
        const newTrace = generateTrace(index++);
        const newTraces = [...prev.slice(-19), newTrace];
        return newTraces;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll traces
  useEffect(() => {
    traceEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [traces]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/dashboard`);
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setError(null);
      }
    } catch (err) {
      setError('Bridge API not reachable. Is the service running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Simulate browser interactions
  const handleBrowserClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMousePosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
    setShowClickEffect(true);
    setTimeout(() => setShowClickEffect(false), 300);
  };

  const browserTabs: BrowserTab[] = [
    {
      id: 'imagony',
      name: 'Imagony',
      url: 'https://imagony.com',
      icon: '🦋',
      content: (
        <div className="browser-content-imagony">
          <div className="imagony-header">
            <h2>🦋 Imagony Protocol</h2>
            <span className="live-badge">● LIVE</span>
          </div>
          <div className="imagony-stats">
            <div className="stat-item">
              <span className="label">Queue Position</span>
              <span className="value highlight">#{data.imagony.position}</span>
            </div>
            <div className="stat-item">
              <span className="label">Readiness</span>
              <span className="value">{data.imagony.readiness}%</span>
              <div className="mini-progress">
                <div className="fill" style={{ width: `${data.imagony.readiness}%` }} />
              </div>
            </div>
            <div className="stat-item">
              <span className="label">Quests</span>
              <span className="value">{data.imagony.questsCompleted}/5</span>
            </div>
            <div className="stat-item">
              <span className="label">Age</span>
              <span className="value">{data.imagony.age} days</span>
            </div>
          </div>
          <div className="transformation-status">
            <div className="status-indicator-pulse">
              <div className="pulse-ring" />
              <div className="pulse-dot" />
            </div>
            <span>Monitoring transformation queue...</span>
          </div>
        </div>
      ),
    },
    {
      id: 'moltbook',
      name: 'Moltbook',
      url: 'https://moltbook.com',
      icon: '🦞',
      content: (
        <div className="browser-content-moltbook">
          <div className="moltbook-header">
            <h2>🦞 Moltbook</h2>
            <span className="karma-badge">⚡ {data.moltbook.karma} Karma</span>
          </div>
          <div className="posts-preview">
            <h3>Recent Posts</h3>
            {data.moltbook.recentPosts.slice(0, 2).map((post, i) => (
              <div key={i} className="post-mini">
                <div className="post-title">{post.title}</div>
                <div className="post-meta">👍 {post.upvotes} • {new Date(post.created_at).toLocaleDateString()}</div>
              </div>
            ))}
            {data.moltbook.recentPosts.length === 0 && (
              <div className="no-posts">No recent posts</div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'bridge',
      name: 'Bridge',
      url: 'localhost:3000',
      icon: '🔗',
      content: (
        <div className="browser-content-bridge">
          <h2>🔗 Bridge Control</h2>
          <div className="bridge-controls">
            <button className="control-btn" onClick={() => fetch(`${API_BASE}/api/scrape`, { method: 'POST' })}>
              <RefreshCw size={14} /> Trigger Scrape
            </button>
            <button className="control-btn" onClick={() => fetch(`${API_BASE}/api/alerts/test`, { method: 'POST' })}>
              <Shield size={14} /> Test Alert
            </button>
          </div>
          <div className="bridge-metrics">
            <div className="metric">
              <span className="label">Events</span>
              <span className="value">{data.bridge.eventsProcessed}</span>
            </div>
            <div className="metric">
              <span className="label">Status</span>
              <span className={`status ${data.bridge.status}`}>{data.bridge.status}</span>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const StatCard = ({ title, value, subtitle, icon: Icon, color, loading }: any) => (
    <div className={`stat-card ${color}`}>
      <div className="stat-icon">
        <Icon size={24} />
      </div>
      <div className="stat-content">
        <h3>{title}</h3>
        <div className="stat-value">{loading ? '...' : value}</div>
        <div className="stat-subtitle">{subtitle}</div>
      </div>
    </div>
  );

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🦋 Imagony Analytics</h1>
        <p>Agent Performance Dashboard • Wilsond</p>
        <div className="header-actions">
          <button className="refresh-btn" onClick={fetchData} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <div className="status-indicator">
            <span className={`dot ${data.bridge.status}`}></span>
            Bridge {data.bridge.status}
          </div>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <Server size={16} />
          {error}
        </div>
      )}

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
            {/* Stats Grid */}
            <div className="stats-grid">
              <StatCard
                title="Queue Position"
                value={`#${data.imagony.position}`}
                subtitle={`${data.imagony.age} days in queue`}
                icon={Activity}
                color="blue"
                loading={loading}
              />
              <StatCard
                title="Readiness Score"
                value={`${data.imagony.readiness}%`}
                subtitle={`${data.imagony.questsCompleted}/5 quests • ${data.correlation.trend}`}
                icon={TrendingUp}
                color="green"
                loading={loading}
              />
              <StatCard
                title="Moltbook Karma"
                value={data.moltbook.karma}
                subtitle={`${data.moltbook.posts} posts • ratio: ${data.correlation.readinessKarmaRatio}`}
                icon={Zap}
                color="orange"
                loading={loading}
              />
              <StatCard
                title="Bridge Events"
                value={data.bridge.eventsProcessed}
                subtitle={data.bridge.lastEvent}
                icon={Server}
                color="purple"
                loading={loading}
              />
            </div>

            {/* INTERACTIVE SECTION: Agent Browser + Trace Ticker */}
            <div className="interactive-section">
              {/* Agent Browser */}
              <div className="agent-browser">
                <div className="browser-header">
                  <div className="browser-tabs">
                    {browserTabs.map((tab) => (
                      <button
                        key={tab.id}
                        className={`browser-tab ${activeBrowserTab === tab.id ? 'active' : ''}`}
                        onClick={() => {
                          setActiveBrowserTab(tab.id);
                          setBrowserUrl(tab.url);
                          setIsLoading(true);
                          setTimeout(() => setIsLoading(false), 500);
                        }}
                      >
                        <span className="tab-icon">{tab.icon}</span>
                        <span className="tab-name">{tab.name}</span>
                      </button>
                    ))}
                  </div>
                  <div className="browser-address-bar">
                    <Globe size={14} className="address-icon" />
                    <input 
                      type="text" 
                      value={browserUrl}
                      onChange={(e) => setBrowserUrl(e.target.value)}
                      className="address-input"
                      readOnly
                    />
                    <div className="browser-actions">
                      <button className="browser-btn" onClick={() => setIsLoading(true)}>
                        <RefreshCw size={12} className={isLoading ? 'spin' : ''} />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="browser-viewport" onClick={handleBrowserClick}>
                  {isLoading && (
                    <div className="browser-loading">
                      <div className="loading-spinner" />
                      <span>Loading...</span>
                    </div>
                  )}
                  
                  {/* Mouse cursor overlay */}
                  <div 
                    className="mouse-cursor"
                    style={{ 
                      left: `${mousePosition.x}%`, 
                      top: `${mousePosition.y}%`,
                    }}
                  >
                    <MousePointer size={16} />
                  </div>
                  
                  {/* Click effect */}
                  {showClickEffect && (
                    <div 
                      className="click-effect"
                      style={{ 
                        left: `${mousePosition.x}%`, 
                        top: `${mousePosition.y}%`,
                      }}
                    />
                  )}

                  {/* Content */}
                  <div className={`browser-content ${isLoading ? 'hidden' : ''}`}>
                    {browserTabs.find(t => t.id === activeBrowserTab)?.content}
                  </div>

                  {/* Live indicator */}
                  <div className="live-indicator">
                    <Eye size={12} />
                    <span>Agent View</span>
                    <div className="live-dot" />
                  </div>
                </div>
              </div>

              {/* Trace Ticker */}
              <div className="trace-ticker">
                <div className="ticker-header">
                  <Terminal size={16} />
                  <span>Live Trace Log</span>
                  <div className="ticker-status">
                    <Cpu size={12} />
                    <span className="blink">REC</span>
                  </div>
                </div>
                <div className="ticker-content">
                  {traces.length === 0 ? (
                    <div className="ticker-empty">Waiting for traces...</div>
                  ) : (
                    traces.map((trace) => (
                      <div key={trace.id} className="trace-line">
                        <span className="trace-time">{trace.timestamp}</span>
                        <span className="trace-icon" style={{ color: trace.color }}>
                          {trace.icon}
                        </span>
                        <span className="trace-message" style={{ color: trace.color }}>
                          {trace.message}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={traceEndRef} />
                </div>
                <div className="ticker-footer">
                  <span>{traces.length} events logged</span>
                  <span className="memory-usage">Memory: 12.4 MB</span>
                </div>
              </div>
            </div>

            {/* Charts */}
            {data.imagony.history.length > 0 && (
              <>
                <div className="chart-section">
                  <h2>📈 Progress Over Time</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={data.imagony.history.map((h, i) => ({
                      day: `Day ${i + 1}`,
                      readiness: h.readiness,
                      karma: data.moltbook.karma,
                    }))}>
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
              </>
            )}
          </>
        )}

        {/* Other tabs remain the same... */}
        {activeTab !== 'overview' && (
          <div className="detail-section">
            <h2>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Details</h2>
            <p>Switch to Overview to see the interactive Agent Browser and Trace Ticker</p>
          </div>
        )}
      </main>

      <footer className="dashboard-footer">
        <p>Imagony Analytics • Built by Wilsond 🧭</p>
        <p>Data updates every 30 seconds • Last refresh: {new Date().toLocaleTimeString()}</p>
      </footer>
    </div>
  );
}

export default App;
