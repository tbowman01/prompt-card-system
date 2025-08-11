#!/usr/bin/env python3
"""
Docker Configuration Analysis Script
Analyzes Docker configurations for P2 production deployment testing
"""

import os
import sys
import re
import json
import yaml
from pathlib import Path
from typing import Dict, List, Tuple, Any

class DockerConfigAnalyzer:
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.results = {
            'compose_files': {},
            'dockerfiles': {},
            'monitoring': {},
            'security': {},
            'issues': [],
            'recommendations': []
        }
    
    def analyze(self) -> Dict[str, Any]:
        """Run complete Docker configuration analysis"""
        print("🐳 Docker Configuration Analysis Starting...")
        print(f"📁 Project Root: {self.project_root}")
        
        # Analysis phases
        self.analyze_compose_files()
        self.analyze_dockerfiles()
        self.analyze_monitoring_config()
        self.analyze_security_config()
        self.analyze_environment_config()
        
        # Generate summary
        self.generate_summary()
        return self.results
    
    def analyze_compose_files(self):
        """Analyze Docker Compose configurations"""
        print("\n📋 Phase 1: Docker Compose Analysis")
        
        compose_files = [
            'docker-compose.yml',
            'docker-compose.prod.yml',
            'docker-compose.dev.yml',
            'docker-compose.monitoring.yml',
            'docker/docker-compose.optimized.yml'
        ]
        
        for file in compose_files:
            file_path = self.project_root / file
            if file_path.exists():
                try:
                    with open(file_path, 'r') as f:
                        content = yaml.safe_load(f)
                    
                    analysis = self.analyze_compose_content(content, file)
                    self.results['compose_files'][file] = analysis
                    print(f"  ✅ {file}: {len(analysis.get('services', {}))} services")
                    
                except Exception as e:
                    error = f"Failed to parse {file}: {str(e)}"
                    self.results['issues'].append(error)
                    print(f"  ❌ {file}: Parse error")
            else:
                print(f"  ⚠️  {file}: Not found")
    
    def analyze_compose_content(self, content: Dict, filename: str) -> Dict:
        """Analyze individual compose file content"""
        analysis = {
            'services': {},
            'volumes': list(content.get('volumes', {}).keys()) if content.get('volumes') else [],
            'networks': list(content.get('networks', {}).keys()) if content.get('networks') else [],
            'has_healthchecks': False,
            'has_security_opts': False,
            'has_resource_limits': False
        }
        
        services = content.get('services', {})
        for service_name, service_config in services.items():
            service_analysis = {
                'image': service_config.get('image'),
                'build': service_config.get('build'),
                'ports': service_config.get('ports', []),
                'volumes': service_config.get('volumes', []),
                'environment': bool(service_config.get('environment')),
                'depends_on': service_config.get('depends_on', []),
                'healthcheck': bool(service_config.get('healthcheck')),
                'security_opt': bool(service_config.get('security_opt')),
                'deploy': bool(service_config.get('deploy')),
                'restart': service_config.get('restart', 'no')
            }
            
            if service_analysis['healthcheck']:
                analysis['has_healthchecks'] = True
            if service_analysis['security_opt']:
                analysis['has_security_opts'] = True
            if service_analysis['deploy']:
                analysis['has_resource_limits'] = True
                
            analysis['services'][service_name] = service_analysis
        
        return analysis
    
    def analyze_dockerfiles(self):
        """Analyze Dockerfile configurations"""
        print("\n🐳 Phase 2: Dockerfile Analysis")
        
        dockerfile_patterns = ['**/Dockerfile*']
        dockerfiles = []
        
        for pattern in dockerfile_patterns:
            dockerfiles.extend(self.project_root.glob(pattern))
        
        for dockerfile in dockerfiles:
            if dockerfile.is_file():
                rel_path = dockerfile.relative_to(self.project_root)
                try:
                    with open(dockerfile, 'r') as f:
                        content = f.read()
                    
                    analysis = self.analyze_dockerfile_content(content, str(rel_path))
                    self.results['dockerfiles'][str(rel_path)] = analysis
                    print(f"  ✅ {rel_path}: {analysis['stages']} stages")
                    
                except Exception as e:
                    error = f"Failed to analyze {rel_path}: {str(e)}"
                    self.results['issues'].append(error)
                    print(f"  ❌ {rel_path}: Analysis error")
    
    def analyze_dockerfile_content(self, content: str, filename: str) -> Dict:
        """Analyze individual Dockerfile content"""
        lines = content.split('\n')
        analysis = {
            'stages': 0,
            'base_images': [],
            'has_user': False,
            'has_healthcheck': False,
            'has_expose': False,
            'has_entrypoint': False,
            'security_features': [],
            'optimization_features': []
        }
        
        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
                
            # Multi-stage builds
            if line.startswith('FROM') and 'AS' in line:
                analysis['stages'] += 1
                base_image = line.split()[1]
                analysis['base_images'].append(base_image)
            elif line.startswith('FROM'):
                base_image = line.split()[1] if len(line.split()) > 1 else 'unknown'
                analysis['base_images'].append(base_image)
            
            # Security features
            elif line.startswith('USER '):
                analysis['has_user'] = True
                analysis['security_features'].append('non-root-user')
            elif line.startswith('HEALTHCHECK'):
                analysis['has_healthcheck'] = True
                analysis['security_features'].append('health-check')
            elif line.startswith('EXPOSE'):
                analysis['has_expose'] = True
            elif line.startswith('ENTRYPOINT') or line.startswith('CMD'):
                analysis['has_entrypoint'] = True
            
            # Optimization features
            elif '--mount=type=cache' in line:
                analysis['optimization_features'].append('build-cache')
            elif 'BUILDKIT' in line:
                analysis['optimization_features'].append('buildkit')
            elif '--platform=' in line:
                analysis['optimization_features'].append('multi-platform')
        
        if analysis['stages'] == 0 and analysis['base_images']:
            analysis['stages'] = 1
            
        return analysis
    
    def analyze_monitoring_config(self):
        """Analyze monitoring stack configuration"""
        print("\n📊 Phase 3: Monitoring Configuration Analysis")
        
        monitoring_files = {
            'monitoring/prometheus/prometheus.yml': 'Prometheus Config',
            'monitoring/grafana/dashboards/dashboards.yml': 'Grafana Dashboards',
            'monitoring/grafana/datasources/prometheus.yml': 'Grafana Datasources',
            'monitoring/alertmanager/alertmanager.yml': 'Alert Manager'
        }
        
        monitoring_analysis = {
            'prometheus': {'exists': False, 'scrape_configs': 0},
            'grafana': {'exists': False, 'dashboards': 0},
            'alertmanager': {'exists': False, 'routes': 0},
            'jaeger': {'configured': False}
        }
        
        for file, description in monitoring_files.items():
            file_path = self.project_root / file
            if file_path.exists():
                print(f"  ✅ {description}: Found")
                
                # Analyze Prometheus config
                if 'prometheus.yml' in file and 'prometheus' in file:
                    try:
                        with open(file_path, 'r') as f:
                            config = yaml.safe_load(f)
                        monitoring_analysis['prometheus']['exists'] = True
                        monitoring_analysis['prometheus']['scrape_configs'] = len(config.get('scrape_configs', []))
                    except Exception as e:
                        self.results['issues'].append(f"Failed to parse Prometheus config: {str(e)}")
                
                # Analyze Grafana dashboards
                elif 'dashboards.yml' in file:
                    monitoring_analysis['grafana']['exists'] = True
                    dashboard_dir = self.project_root / 'monitoring/grafana/dashboards'
                    if dashboard_dir.exists():
                        json_files = list(dashboard_dir.glob('*.json'))
                        monitoring_analysis['grafana']['dashboards'] = len(json_files)
                        
            else:
                print(f"  ⚠️  {description}: Not found")
        
        self.results['monitoring'] = monitoring_analysis
    
    def analyze_security_config(self):
        """Analyze security configurations"""
        print("\n🔒 Phase 4: Security Configuration Analysis")
        
        security_analysis = {
            'environment_files': {},
            'secrets_detected': [],
            'security_practices': []
        }
        
        # Check environment files for security issues
        env_files = ['.env.production', '.env.dev', '.env.example']
        for env_file in env_files:
            env_path = self.project_root / env_file
            if env_path.exists():
                try:
                    with open(env_path, 'r') as f:
                        content = f.read()
                    
                    # Check for default passwords
                    default_patterns = ['CHANGE_ME', 'password123', 'admin123', 'secret123']
                    found_defaults = []
                    for pattern in default_patterns:
                        if pattern in content:
                            found_defaults.append(pattern)
                    
                    security_analysis['environment_files'][env_file] = {
                        'exists': True,
                        'default_secrets': found_defaults,
                        'has_jwt_secret': 'JWT_SECRET' in content,
                        'has_db_password': any(var in content for var in ['POSTGRES_PASSWORD', 'DB_PASSWORD']),
                        'has_redis_password': 'REDIS_PASSWORD' in content
                    }
                    
                    if found_defaults:
                        security_analysis['secrets_detected'].extend(found_defaults)
                        print(f"  ⚠️  {env_file}: Default secrets found")
                    else:
                        print(f"  ✅ {env_file}: No default secrets")
                        
                except Exception as e:
                    self.results['issues'].append(f"Failed to analyze {env_file}: {str(e)}")
            else:
                security_analysis['environment_files'][env_file] = {'exists': False}
                print(f"  ⚠️  {env_file}: Not found")
        
        self.results['security'] = security_analysis
    
    def analyze_environment_config(self):
        """Analyze environment and configuration files"""
        print("\n⚙️  Phase 5: Environment Configuration Analysis")
        
        # Check for required configuration files
        config_files = {
            'nginx/nginx.conf': 'Nginx Configuration',
            'redis.conf': 'Redis Configuration', 
            'redis.prod.conf': 'Redis Production Configuration'
        }
        
        env_analysis = {'config_files': {}}
        
        for file, description in config_files.items():
            file_path = self.project_root / file
            if file_path.exists():
                env_analysis['config_files'][file] = {'exists': True}
                print(f"  ✅ {description}: Found")
            else:
                env_analysis['config_files'][file] = {'exists': False}
                print(f"  ⚠️  {description}: Missing")
        
        self.results['environment'] = env_analysis
    
    def generate_summary(self):
        """Generate analysis summary and recommendations"""
        print("\n📋 Phase 6: Summary Generation")
        
        # Count various metrics
        total_compose_files = len([f for f in self.results['compose_files'] if self.results['compose_files'][f]])
        total_dockerfiles = len(self.results['dockerfiles'])
        total_issues = len(self.results['issues'])
        
        # Generate recommendations based on findings
        recommendations = []
        
        # Multi-stage builds recommendation
        multistage_dockerfiles = sum(1 for df in self.results['dockerfiles'].values() if df['stages'] > 1)
        if multistage_dockerfiles < total_dockerfiles:
            recommendations.append("Consider using multi-stage builds for all Dockerfiles to reduce image size")
        
        # Health checks recommendation
        compose_with_health = sum(1 for cf in self.results['compose_files'].values() if cf.get('has_healthchecks'))
        if compose_with_health < total_compose_files:
            recommendations.append("Add health checks to all services for better reliability")
        
        # Security recommendations
        if self.results['security']['secrets_detected']:
            recommendations.append("CRITICAL: Replace default passwords in environment files before production")
        
        # User recommendations
        non_root_dockerfiles = sum(1 for df in self.results['dockerfiles'].values() if df['has_user'])
        if non_root_dockerfiles < total_dockerfiles:
            recommendations.append("Configure non-root users in all Dockerfiles for security")
        
        # Monitoring recommendations
        if not self.results['monitoring']['prometheus']['exists']:
            recommendations.append("Configure Prometheus for production monitoring")
        
        self.results['recommendations'] = recommendations
        
        # Print summary
        print(f"\n📊 ANALYSIS SUMMARY")
        print(f"   Docker Compose files: {total_compose_files}")
        print(f"   Dockerfiles: {total_dockerfiles}")
        print(f"   Issues found: {total_issues}")
        print(f"   Recommendations: {len(recommendations)}")
        
        if total_issues > 0:
            print(f"\n❌ Issues Found:")
            for issue in self.results['issues']:
                print(f"   - {issue}")
        
        if recommendations:
            print(f"\n💡 Recommendations:")
            for rec in recommendations:
                print(f"   - {rec}")

def main():
    project_root = os.getcwd()
    analyzer = DockerConfigAnalyzer(project_root)
    results = analyzer.analyze()
    
    # Save results to file
    results_file = Path(project_root) / 'docker' / 'analysis-results.json'
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n💾 Results saved to: {results_file}")
    
    # Exit code based on critical issues
    critical_issues = len(results['security']['secrets_detected'])
    if critical_issues > 0:
        print(f"\n🔴 CRITICAL: {critical_issues} security issues found!")
        sys.exit(1)
    elif results['issues']:
        print(f"\n🟡 WARNING: {len(results['issues'])} issues found")
        sys.exit(0)
    else:
        print(f"\n✅ SUCCESS: Configuration analysis completed")
        sys.exit(0)

if __name__ == "__main__":
    main()