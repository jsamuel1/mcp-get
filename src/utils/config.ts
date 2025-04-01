import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { loadPackage } from './package-registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);

export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  runtime?: 'node' | 'python';
}

export interface ClaudeConfig {
  mcpServers?: Record<string, MCPServerConfig>;
  [key: string]: any;
}

function getPackageRuntime(packageName: string): 'node' | 'python' {
  const pkg = loadPackage(packageName);
  return pkg?.runtime || 'node';
}

export function getConfigPath(): string {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
  }

  const configDir = path.join(os.homedir(), 'Library', 'Application Support', 'Claude');
  return path.join(configDir, 'claude_desktop_config.json');
}

export function getAmazonQConfigPath(): string {
  const homeDir = os.homedir();
  if (process.platform === 'win32') {
    return path.join(homeDir, '.aws', 'amazonq', 'mcp.json');
  }
  return path.join(homeDir, '.aws', 'amazonq', 'mcp.json');
}

export function readConfig(): ClaudeConfig {
  // Merge all available config files
  return readMergedConfigs();
}

export function readClaudeConfig(): ClaudeConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { mcpServers: {} };
  }
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return {
      ...config,
      mcpServers: config.mcpServers || {}
    };
  } catch (error) {
    console.error('Error reading Claude config:', error);
    return { mcpServers: {} };
  }
}

export function readAmazonQConfig(): ClaudeConfig {
  const configPath = getAmazonQConfigPath();
  if (!fs.existsSync(configPath)) {
    return { mcpServers: {} };
  }
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return {
      ...config,
      mcpServers: config.mcpServers || {}
    };
  } catch (error) {
    console.error('Error reading Amazon Q config:', error);
    return { mcpServers: {} };
  }
}

export function readMergedConfigs(): ClaudeConfig {
  const claudeConfig = readClaudeConfig();
  const amazonQConfig = readAmazonQConfig();
  
  // Start with an empty config with mcpServers initialized
  const mergedConfig: ClaudeConfig = {
    mcpServers: {}
  };
  
  // Merge other properties from both configs
  Object.keys(claudeConfig).forEach(key => {
    if (key !== 'mcpServers') {
      mergedConfig[key] = claudeConfig[key];
    }
  });
  
  Object.keys(amazonQConfig).forEach(key => {
    if (key !== 'mcpServers' && !mergedConfig[key]) {
      mergedConfig[key] = amazonQConfig[key];
    }
  });
  
  // Ensure mcpServers is initialized in all configs
  if (!claudeConfig.mcpServers) claudeConfig.mcpServers = {};
  if (!amazonQConfig.mcpServers) amazonQConfig.mcpServers = {};
  if (!mergedConfig.mcpServers) mergedConfig.mcpServers = {};
  
  // Merge mcpServers from both configs
  Object.keys(claudeConfig.mcpServers).forEach(serverName => {
    mergedConfig.mcpServers![serverName] = claudeConfig.mcpServers![serverName];
  });
  
  Object.keys(amazonQConfig.mcpServers).forEach(serverName => {
    if (!mergedConfig.mcpServers![serverName]) {
      mergedConfig.mcpServers![serverName] = amazonQConfig.mcpServers![serverName];
    }
  });
  
  return mergedConfig;
}

export function writeConfig(config: ClaudeConfig): void {
  // Always write to both Claude and Amazon Q configs
  
  // Write to Claude config
  const claudeConfigPath = getConfigPath();
  const claudeConfigDir = path.dirname(claudeConfigPath);
  
  if (!fs.existsSync(claudeConfigDir)) {
    fs.mkdirSync(claudeConfigDir, { recursive: true });
  }
  
  // If Claude config exists, preserve any non-mcpServers properties
  let existingClaudeConfig: ClaudeConfig = { mcpServers: {} };
  if (fs.existsSync(claudeConfigPath)) {
    try {
      existingClaudeConfig = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf8'));
      // Remove mcpServers as we'll replace it
      delete existingClaudeConfig.mcpServers;
    } catch (e) {
      // If parsing fails, use empty object
      existingClaudeConfig = { mcpServers: {} };
    }
  }
  
  // Ensure mcpServers exists in config
  if (!config.mcpServers) {
    config.mcpServers = {};
  }
  
  // Write merged config to Claude
  const claudeConfig = {
    ...existingClaudeConfig,
    mcpServers: config.mcpServers
  };
  fs.writeFileSync(claudeConfigPath, JSON.stringify(claudeConfig, null, 2));
  
  // Write to Amazon Q config
  const amazonQConfigPath = getAmazonQConfigPath();
  const amazonQConfigDir = path.dirname(amazonQConfigPath);
  
  if (!fs.existsSync(amazonQConfigDir)) {
    fs.mkdirSync(amazonQConfigDir, { recursive: true });
  }
  
  // If Amazon Q config exists, preserve any non-mcpServers properties
  let existingAmazonQConfig: ClaudeConfig = { mcpServers: {} };
  if (fs.existsSync(amazonQConfigPath)) {
    try {
      existingAmazonQConfig = JSON.parse(fs.readFileSync(amazonQConfigPath, 'utf8'));
      // Remove mcpServers as we'll replace it
      delete existingAmazonQConfig.mcpServers;
    } catch (e) {
      // If parsing fails, use empty object
      existingAmazonQConfig = { mcpServers: {} };
    }
  }
  
  // Write merged config to Amazon Q
  const amazonQConfig = {
    ...existingAmazonQConfig,
    mcpServers: config.mcpServers
  };
  fs.writeFileSync(amazonQConfigPath, JSON.stringify(amazonQConfig, null, 2));
}

export async function installMCPServer(packageName: string, envVars?: Record<string, string>, runtime?: 'node' | 'python'): Promise<void> {
  const config = readMergedConfigs();
  const serverName = packageName.replace(/\//g, '-');
  
  const effectiveRuntime = runtime || getPackageRuntime(packageName);
  
  // Ensure mcpServers is initialized
  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  let command = 'npx';
  if (effectiveRuntime === 'python') {
    try {
      const { stdout } = await execAsync('which uvx');
      command = stdout.trim();
    } catch (error) {
      command = 'uvx'; // Fallback to just 'uvx' if which fails
    }
  }
  
  const serverConfig: MCPServerConfig = {
    runtime: effectiveRuntime,
    env: envVars,
    command,
    args: effectiveRuntime === 'python' ? [packageName] : ['-y', packageName]
  };
  
  config.mcpServers[serverName] = serverConfig;
  writeConfig(config);
}

export function envVarsToArgs(envVars: Record<string, string>): string[] {
  return Object.entries(envVars).map(([key, value]) => {
    const argName = key.toLowerCase().replace(/_/g, '-');
    return [`--${argName}`, value];
  }).flat();
}
