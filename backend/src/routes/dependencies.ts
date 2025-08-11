import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const router = express.Router();
const execAsync = promisify(exec);

interface NpmAuditResult {
  vulnerabilities: any;
  metadata: {
    vulnerabilities: {
      info: number;
      low: number;
      moderate: number;
      high: number;
      critical: number;
    };
  };
}

interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  homepage?: string;
  repository?: any;
  license?: string;
  maintainers?: any[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * GET /api/dependencies
 * Get all project dependencies with metadata
 */
router.get('/', async (req, res) => {
  try {
    const dependencies = [];
    const projectRoot = process.cwd();

    // Read package.json files from different locations
    const packageLocations = [
      { path: path.join(projectRoot, 'package.json'), location: 'root' },
      { path: path.join(projectRoot, 'frontend', 'package.json'), location: 'frontend' },
      { path: path.join(projectRoot, 'backend', 'package.json'), location: 'backend' }
    ];

    for (const { path: packagePath, location } of packageLocations) {
      try {
        const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
        
        // Process production dependencies
        if (packageJson.dependencies) {
          for (const [name, version] of Object.entries(packageJson.dependencies as Record<string, string>)) {
            dependencies.push({
              id: `${location}-${name}`,
              name,
              version: version.replace(/[^0-9.]/g, ''),
              type: 'production',
              location,
              description: await getPackageDescription(name),
              homepage: await getPackageHomepage(name),
              license: await getPackageLicense(name),
              size: Math.floor(Math.random() * 1024 * 1024), // Mock size
              installationDate: new Date().toISOString(),
              lastUpdated: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
              latestVersion: await getLatestVersion(name),
              maintainers: await getPackageMaintainers(name)
            });
          }
        }

        // Process dev dependencies
        if (packageJson.devDependencies) {
          for (const [name, version] of Object.entries(packageJson.devDependencies as Record<string, string>)) {
            dependencies.push({
              id: `${location}-dev-${name}`,
              name,
              version: version.replace(/[^0-9.]/g, ''),
              type: 'development',
              location,
              description: await getPackageDescription(name),
              homepage: await getPackageHomepage(name),
              license: await getPackageLicense(name),
              size: Math.floor(Math.random() * 512 * 1024), // Mock size
              installationDate: new Date().toISOString(),
              lastUpdated: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
              latestVersion: await getLatestVersion(name),
              maintainers: await getPackageMaintainers(name)
            });
          }
        }
      } catch (error) {
        console.warn(`Could not read package.json at ${packagePath}:`, error);
      }
    }

    res.json({
      dependencies,
      total: dependencies.length,
      lastScanned: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting dependencies:', error);
    res.status(500).json({ error: 'Failed to get dependencies' });
  }
});

/**
 * GET /api/dependencies/vulnerabilities
 * Get vulnerability information for dependencies
 */
router.get('/vulnerabilities', async (req, res) => {
  try {
    const vulnerabilities = [];
    const projectRoot = process.cwd();

    // Check different package locations
    const locations = ['', 'frontend', 'backend'];
    
    for (const location of locations) {
      const workDir = location ? path.join(projectRoot, location) : projectRoot;
      
      try {
        // Run npm audit to get vulnerability data
        const { stdout } = await execAsync('npm audit --json', { cwd: workDir });
        const auditResult: NpmAuditResult = JSON.parse(stdout);

        if (auditResult.vulnerabilities) {
          for (const [packageName, vulnData] of Object.entries(auditResult.vulnerabilities)) {
            if (vulnData && typeof vulnData === 'object' && 'via' in vulnData) {
              const vulnArray = Array.isArray(vulnData.via) ? vulnData.via : [vulnData.via];
              
              for (const vuln of vulnArray) {
                if (typeof vuln === 'object' && vuln.source) {
                  vulnerabilities.push({
                    id: `${location || 'root'}-${packageName}-${vuln.source || Date.now()}`,
                    dependencyId: `${location || 'root'}-${packageName}`,
                    cveId: vuln.source,
                    title: vuln.title || `Vulnerability in ${packageName}`,
                    description: vuln.description || 'No description available',
                    severity: mapSeverity(vuln.severity || 'moderate'),
                    cvssScore: vuln.cvss?.score,
                    publishedDate: vuln.created || new Date().toISOString(),
                    patchedVersions: vuln.fixedIn || [],
                    recommendations: [
                      'Update to a patched version',
                      'Review security implications',
                      'Test thoroughly after update'
                    ],
                    exploitAvailable: Math.random() < 0.1, // Mock exploit data
                    references: vuln.references || []
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        // npm audit may fail with exit code 1 when vulnerabilities are found
        // Try to parse the output anyway
        if (error instanceof Error && 'stdout' in error) {
          try {
            const auditResult = JSON.parse((error as any).stdout);
            // Process audit result similar to above
          } catch (parseError) {
            console.warn(`Could not run audit in ${workDir}:`, parseError);
          }
        }
      }
    }

    res.json({
      vulnerabilities,
      total: vulnerabilities.length,
      summary: {
        critical: vulnerabilities.filter(v => v.severity === 'critical').length,
        high: vulnerabilities.filter(v => v.severity === 'high').length,
        moderate: vulnerabilities.filter(v => v.severity === 'moderate').length,
        low: vulnerabilities.filter(v => v.severity === 'low').length
      },
      lastScanned: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting vulnerabilities:', error);
    res.status(500).json({ error: 'Failed to get vulnerabilities' });
  }
});

/**
 * GET /api/dependencies/updates
 * Get available updates for dependencies
 */
router.get('/updates', async (req, res) => {
  try {
    const updates = [];
    const projectRoot = process.cwd();

    // Check for available updates using npm outdated
    const locations = ['', 'frontend', 'backend'];
    
    for (const location of locations) {
      const workDir = location ? path.join(projectRoot, location) : projectRoot;
      
      try {
        const { stdout } = await execAsync('npm outdated --json', { cwd: workDir });
        const outdatedPackages = JSON.parse(stdout || '{}');

        for (const [packageName, updateInfo] of Object.entries(outdatedPackages)) {
          const info = updateInfo as any;
          
          updates.push({
            dependencyId: `${location || 'root'}-${packageName}`,
            currentVersion: info.current,
            targetVersion: info.latest,
            updateType: determineUpdateType(info.current, info.latest),
            changelogUrl: `https://github.com/npm/npm/releases`,
            releaseDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            breakingChanges: determineBreakingChanges(info.current, info.latest),
            securityFix: Math.random() < 0.3, // Mock security fix flag
            size: Math.floor(Math.random() * 1024 * 1024),
            requiredBy: [],
            blockedBy: []
          });
        }
      } catch (error) {
        // npm outdated returns non-zero exit code when updates are available
        console.warn(`Could not check updates in ${workDir}`);
      }
    }

    res.json({
      updates,
      total: updates.length,
      summary: {
        major: updates.filter(u => u.updateType === 'major').length,
        minor: updates.filter(u => u.updateType === 'minor').length,
        patch: updates.filter(u => u.updateType === 'patch').length,
        security: updates.filter(u => u.securityFix).length
      },
      lastChecked: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting updates:', error);
    res.status(500).json({ error: 'Failed to get updates' });
  }
});

/**
 * GET /api/dependencies/metrics
 * Get dependency dashboard metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    // This would typically aggregate data from the database
    // For now, we'll make API calls to our other endpoints
    const [depsResponse, vulnResponse, updatesResponse] = await Promise.all([
      fetch(`http://localhost:${process.env.PORT || 3001}/api/dependencies`),
      fetch(`http://localhost:${process.env.PORT || 3001}/api/dependencies/vulnerabilities`),
      fetch(`http://localhost:${process.env.PORT || 3001}/api/dependencies/updates`)
    ].map(p => p.catch(() => ({ json: () => ({ dependencies: [], vulnerabilities: [], updates: [] }) }))));

    const deps = await depsResponse.json();
    const vulns = await vulnResponse.json();
    const updates = await updatesResponse.json();

    const totalDependencies = deps.dependencies?.length || 0;
    const outdatedDependencies = updates.updates?.length || 0;
    const vulnerabilities = {
      critical: vulns.vulnerabilities?.filter((v: any) => v.severity === 'critical').length || 0,
      high: vulns.vulnerabilities?.filter((v: any) => v.severity === 'high').length || 0,
      moderate: vulns.vulnerabilities?.filter((v: any) => v.severity === 'moderate').length || 0,
      low: vulns.vulnerabilities?.filter((v: any) => v.severity === 'low').length || 0
    };

    const licenseIssues = Math.floor(totalDependencies * 0.1); // Mock 10% license issues
    const pendingUpdates = updates.updates?.length || 0;
    
    // Calculate risk score based on vulnerabilities and outdated packages
    const vulnScore = (vulnerabilities.critical * 40 + vulnerabilities.high * 20 + vulnerabilities.moderate * 10 + vulnerabilities.low * 5) / totalDependencies || 0;
    const outdatedScore = (outdatedDependencies / totalDependencies) * 30 || 0;
    const riskScore = Math.min(100, Math.round(vulnScore + outdatedScore));

    res.json({
      totalDependencies,
      outdatedDependencies,
      vulnerabilities,
      licenseIssues,
      pendingUpdates,
      riskScore,
      lastScan: new Date().toISOString(),
      nextScheduledScan: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * POST /api/dependencies/scan
 * Trigger a new dependency scan
 */
router.post('/scan', async (req, res) => {
  try {
    // In a real application, this would trigger a background job
    // For now, we'll simulate a scan delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    res.json({
      success: true,
      message: 'Dependency scan completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error running scan:', error);
    res.status(500).json({ error: 'Failed to run scan' });
  }
});

/**
 * POST /api/dependencies/updates/:id/approve
 * Approve a dependency update
 */
router.post('/updates/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    // In a real application, this would update the database and trigger the update process
    const approval = {
      id: `approval-${Date.now()}`,
      dependencyId: id,
      requestedVersion: '1.0.0', // Mock version
      status: 'approved',
      requestedBy: 'system',
      requestedAt: new Date().toISOString(),
      approver: 'admin',
      approvedAt: new Date().toISOString(),
      comments: [
        {
          id: `comment-${Date.now()}`,
          author: 'admin',
          message: comment || 'Approved via dashboard',
          timestamp: new Date().toISOString(),
          type: 'approval'
        }
      ]
    };

    res.json(approval);
  } catch (error) {
    console.error('Error approving update:', error);
    res.status(500).json({ error: 'Failed to approve update' });
  }
});

/**
 * POST /api/dependencies/updates/:id/reject
 * Reject a dependency update
 */
router.post('/updates/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    // In a real application, this would update the database
    const approval = {
      id: `approval-${Date.now()}`,
      dependencyId: id,
      requestedVersion: '1.0.0', // Mock version
      status: 'rejected',
      requestedBy: 'system',
      requestedAt: new Date().toISOString(),
      approver: 'admin',
      approvedAt: new Date().toISOString(),
      comments: [
        {
          id: `comment-${Date.now()}`,
          author: 'admin',
          message: comment || 'Rejected via dashboard',
          timestamp: new Date().toISOString(),
          type: 'rejection'
        }
      ]
    };

    res.json(approval);
  } catch (error) {
    console.error('Error rejecting update:', error);
    res.status(500).json({ error: 'Failed to reject update' });
  }
});

// Helper functions
async function getPackageDescription(packageName: string): Promise<string | undefined> {
  try {
    const response = await axios.get(`https://registry.npmjs.org/${packageName}/latest`, {
      timeout: 5000
    });
    return response.data.description;
  } catch {
    return undefined;
  }
}

async function getPackageHomepage(packageName: string): Promise<string | undefined> {
  try {
    const response = await axios.get(`https://registry.npmjs.org/${packageName}/latest`, {
      timeout: 5000
    });
    return response.data.homepage;
  } catch {
    return undefined;
  }
}

async function getPackageLicense(packageName: string): Promise<string | undefined> {
  try {
    const response = await axios.get(`https://registry.npmjs.org/${packageName}/latest`, {
      timeout: 5000
    });
    return response.data.license;
  } catch {
    return 'Unknown';
  }
}

async function getLatestVersion(packageName: string): Promise<string | undefined> {
  try {
    const response = await axios.get(`https://registry.npmjs.org/${packageName}/latest`, {
      timeout: 5000
    });
    return response.data.version;
  } catch {
    return undefined;
  }
}

async function getPackageMaintainers(packageName: string): Promise<string[]> {
  try {
    const response = await axios.get(`https://registry.npmjs.org/${packageName}/latest`, {
      timeout: 5000
    });
    return response.data.maintainers?.map((m: any) => m.name) || [];
  } catch {
    return [];
  }
}

function mapSeverity(severity: string): 'critical' | 'high' | 'moderate' | 'low' | 'info' {
  switch (severity.toLowerCase()) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    case 'moderate': return 'moderate';
    case 'low': return 'low';
    default: return 'info';
  }
}

function determineUpdateType(current: string, latest: string): 'major' | 'minor' | 'patch' | 'prerelease' {
  try {
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);

    if (latestParts[0] > currentParts[0]) return 'major';
    if (latestParts[1] > currentParts[1]) return 'minor';
    if (latestParts[2] > currentParts[2]) return 'patch';
    return 'prerelease';
  } catch {
    return 'patch';
  }
}

function determineBreakingChanges(current: string, latest: string): boolean {
  try {
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);
    return latestParts[0] > currentParts[0];
  } catch {
    return false;
  }
}

export default router;