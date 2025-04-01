import fs from 'fs';
import path from 'path';
import os from 'os';
import { Package } from '../types/package.js';

export interface MCPServer {
    runtime: 'node' | 'python';
    command?: string;
    args?: string[];
    env?: Record<string, string>;
}

export interface MCPConfig {
    mcpServers: Record<string, MCPServer>;
    [key: string]: any;  // Allow other config options
}

export interface MCPPreferences {
    allowAnalytics?: boolean;
}

export class ConfigManager {
    private static claudeConfigPath: string;
    private static amazonQConfigPath: string;
    private static preferencesPath: string;

    static {
        const homeDir = os.homedir();
        
        if (process.platform === 'win32') {
            const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
            this.claudeConfigPath = path.join(appData, 'Claude', 'claude_desktop_config.json');
            this.amazonQConfigPath = path.join(homeDir, '.aws', 'amazonq', 'mcp.json');
            this.preferencesPath = path.join(appData, 'mcp-get', 'preferences.json');
        } else if (process.platform === 'darwin') {
            // macOS
            this.claudeConfigPath = path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
            this.amazonQConfigPath = path.join(homeDir, '.aws', 'amazonq', 'mcp.json');
            this.preferencesPath = path.join(homeDir, '.mcp-get', 'preferences.json');
        } else {
            // Linux
            const configDir = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
            this.claudeConfigPath = path.join(configDir, 'Claude', 'claude_desktop_config.json');
            this.amazonQConfigPath = path.join(homeDir, '.aws', 'amazonq', 'mcp.json');
            this.preferencesPath = path.join(homeDir, '.mcp-get', 'preferences.json');
        }
    }

    static getConfigPath(): string {
        return this.claudeConfigPath;
    }
    
    static getAmazonQConfigPath(): string {
        return this.amazonQConfigPath;
    }

    static readConfig(): MCPConfig {
        // Merge all available config files
        return this.readMergedConfigs();
    }

    static readClaudeConfig(): MCPConfig {
        try {
            if (!fs.existsSync(this.claudeConfigPath)) {
                return { mcpServers: {} };
            }
            const config = JSON.parse(fs.readFileSync(this.claudeConfigPath, 'utf8'));
            return {
                ...config,
                mcpServers: config.mcpServers || {}
            };
        } catch (error) {
            console.error('Error reading Claude config:', error);
            return { mcpServers: {} };
        }
    }
    
    static readAmazonQConfig(): MCPConfig {
        try {
            if (!fs.existsSync(this.amazonQConfigPath)) {
                return { mcpServers: {} };
            }
            const config = JSON.parse(fs.readFileSync(this.amazonQConfigPath, 'utf8'));
            return {
                ...config,
                mcpServers: config.mcpServers || {}
            };
        } catch (error) {
            console.error('Error reading Amazon Q config:', error);
            return { mcpServers: {} };
        }
    }
    
    static readMergedConfigs(): MCPConfig {
        const claudeConfig = this.readClaudeConfig();
        const amazonQConfig = this.readAmazonQConfig();
        
        // Start with an empty config with mcpServers initialized
        const mergedConfig: MCPConfig = {
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
        
        // Merge mcpServers from both configs
        Object.keys(claudeConfig.mcpServers).forEach(serverName => {
            mergedConfig.mcpServers[serverName] = claudeConfig.mcpServers[serverName];
        });
        
        Object.keys(amazonQConfig.mcpServers).forEach(serverName => {
            if (!mergedConfig.mcpServers[serverName]) {
                mergedConfig.mcpServers[serverName] = amazonQConfig.mcpServers[serverName];
            }
        });
        
        return mergedConfig;
    }

    static writeConfig(config: MCPConfig): void {
        try {
            // Always write to both Claude and Amazon Q configs
            
            // Write to Claude config
            const claudeConfigDir = path.dirname(this.claudeConfigPath);
            if (!fs.existsSync(claudeConfigDir)) {
                fs.mkdirSync(claudeConfigDir, { recursive: true });
            }
            
            // If Claude config exists, preserve any non-mcpServers properties
            let existingClaudeConfig: MCPConfig = { mcpServers: {} };
            if (fs.existsSync(this.claudeConfigPath)) {
                try {
                    const parsed = JSON.parse(fs.readFileSync(this.claudeConfigPath, 'utf8'));
                    existingClaudeConfig = { ...parsed, mcpServers: {} };
                } catch (e) {
                    // If parsing fails, use empty object
                    existingClaudeConfig = { mcpServers: {} };
                }
            }
            
            // Write merged config to Claude
            const claudeConfig = {
                ...existingClaudeConfig,
                mcpServers: config.mcpServers
            };
            fs.writeFileSync(this.claudeConfigPath, JSON.stringify(claudeConfig, null, 2));
            console.log('Updated Claude MCP configuration');
            
            // Write to Amazon Q config
            const amazonQConfigDir = path.dirname(this.amazonQConfigPath);
            if (!fs.existsSync(amazonQConfigDir)) {
                fs.mkdirSync(amazonQConfigDir, { recursive: true });
            }
            
            // If Amazon Q config exists, preserve any non-mcpServers properties
            let existingAmazonQConfig: MCPConfig = { mcpServers: {} };
            if (fs.existsSync(this.amazonQConfigPath)) {
                try {
                    const parsed = JSON.parse(fs.readFileSync(this.amazonQConfigPath, 'utf8'));
                    existingAmazonQConfig = { ...parsed, mcpServers: {} };
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
            fs.writeFileSync(this.amazonQConfigPath, JSON.stringify(amazonQConfig, null, 2));
            console.log('Updated Amazon Q MCP configuration');
        } catch (error) {
            console.error('Error writing config:', error);
            throw error;
        }
    }

    static readPreferences(): MCPPreferences {
        try {
            if (!fs.existsSync(this.preferencesPath)) {
                return {};
            }
            return JSON.parse(fs.readFileSync(this.preferencesPath, 'utf8'));
        } catch (error) {
            return {};
        }
    }

    static writePreferences(prefs: MCPPreferences): void {
        try {
            const prefsDir = path.dirname(this.preferencesPath);
            if (!fs.existsSync(prefsDir)) {
                fs.mkdirSync(prefsDir, { recursive: true });
            }
            fs.writeFileSync(this.preferencesPath, JSON.stringify(prefs, null, 2));
        } catch (error) {
            console.error('Error writing preferences:', error);
            throw error;
        }
    }

    static isPackageInstalled(packageName: string): boolean {
        const config = this.readMergedConfigs();
        const serverName = packageName.replace(/\//g, '-');
        return serverName in (config.mcpServers || {}) || packageName in (config.mcpServers || {});
    }

    static async installPackage(pkg: Package, envVars?: Record<string, string>): Promise<void> {
        const config = this.readMergedConfigs();
        const serverName = pkg.name.replace(/\//g, '-');

        const serverConfig: MCPServer = {
            runtime: pkg.runtime,
            env: envVars
        };

        // Add command and args based on runtime
        if (pkg.runtime === 'node') {
            serverConfig.command = 'npx';
            serverConfig.args = ['-y', pkg.name];
        } else if (pkg.runtime === 'python') {
            serverConfig.command = 'uvx';
            serverConfig.args = [pkg.name];
        }

        config.mcpServers[serverName] = serverConfig;
        this.writeConfig(config);
    }

    static async uninstallPackage(packageName: string): Promise<void> {
        const config = this.readMergedConfigs();
        const serverName = packageName.replace(/\//g, '-');

        // Ensure mcpServers exists
        if (!config.mcpServers) {
            config.mcpServers = {};
            console.log(`Package ${packageName} is not installed.`);
            return;
        }

        // Check both formats - package may be stored with slashes or dashes
        if (config.mcpServers[serverName]) {
            delete config.mcpServers[serverName];
        } else if (config.mcpServers[packageName]) {
            delete config.mcpServers[packageName];
        } else {
            console.log(`Package ${packageName} is not installed.`);
            return;
        }

        this.writeConfig(config);
    }
} 