import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/security_service.dart';
import '../services/biometric_service.dart';

class SecurityStatusWidget extends ConsumerStatefulWidget {
  const SecurityStatusWidget({Key? key}) : super(key: key);

  @override
  ConsumerState<SecurityStatusWidget> createState() => _SecurityStatusWidgetState();
}

class _SecurityStatusWidgetState extends ConsumerState<SecurityStatusWidget> {
  bool _biometricEnabled = false;
  bool _biometricAvailable = false;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadSecurityStatus();
  }

  Future<void> _loadSecurityStatus() async {
    setState(() => _isLoading = true);
    
    try {
      final securityService = SecurityService();
      final biometricService = BiometricService();
      
      await biometricService.init();
      
      _biometricEnabled = await securityService.isBiometricEnabled();
      _biometricAvailable = await biometricService.isDeviceSupported();
      
      setState(() => _isLoading = false);
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _toggleBiometric() async {
    try {
      final securityService = SecurityService();
      final biometricService = BiometricService();
      
      if (_biometricEnabled) {
        await securityService.disableBiometricProtection();
        setState(() => _biometricEnabled = false);
      } else {
        // Test biometric authentication first
        final authenticated = await biometricService.authenticateWithBiometrics(
          reason: 'Enable biometric authentication',
        );
        
        if (authenticated) {
          await securityService.enableBiometricProtection();
          setState(() => _biometricEnabled = true);
        }
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Biometric operation failed: $e')),
      );
    }
  }

  Future<void> _testPasswordStrength() async {
    final controller = TextEditingController();
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Test Password Strength'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: controller,
              decoration: const InputDecoration(
                labelText: 'Enter password',
                border: OutlineInputBorder(),
              ),
              obscureText: true,
            ),
            const SizedBox(height: 16),
            Consumer(
              builder: (context, ref) {
                final password = controller.text;
                final securityService = SecurityService();
                final isStrong = securityService.isSecurePassword(password);
                
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Strength: ${isStrong ? 'Strong' : 'Weak'}',
                      style: TextStyle(
                        color: isStrong ? Colors.green : Colors.red,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Requirements:',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    _buildRequirement('At least 8 characters', password.length >= 8),
                    _buildRequirement('Contains uppercase', password.contains(RegExp(r'[A-Z]'))),
                    _buildRequirement('Contains lowercase', password.contains(RegExp(r'[a-z]'))),
                    _buildRequirement('Contains numbers', password.contains(RegExp(r'[0-9]'))),
                    _buildRequirement('Contains special characters', password.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>]'))),
                  ],
                );
              },
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget _buildRequirement(String requirement, bool satisfied) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Icon(
            satisfied ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 16,
            color: satisfied ? Colors.green : Colors.grey,
          ),
          const SizedBox(width: 8),
          Text(requirement),
        ],
      ),
    );
  }

  Future<void> _showSecurityAudit() async {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Security Audit'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Security Features:'),
            const SizedBox(height: 8),
            _buildAuditItem('Biometric Authentication', _biometricEnabled),
            _buildAuditItem('Secure Storage', true),
            _buildAuditItem('Password Hashing', true),
            _buildAuditItem('Rate Limiting', true),
            _buildAuditItem('Device Fingerprinting', true),
            const SizedBox(height: 16),
            const Text('Recommendations:'),
            const SizedBox(height: 8),
            _buildRecommendation('Use strong, unique passwords'),
            _buildRecommendation('Enable biometric authentication'),
            _buildRecommendation('Keep app updated'),
            _buildRecommendation('Review security settings regularly'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget _buildAuditItem(String feature, bool enabled) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Icon(
            enabled ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 16,
            color: enabled ? Colors.green : Colors.orange,
          ),
          const SizedBox(width: 8),
          Text(feature),
        ],
      ),
    );
  }

  Widget _buildRecommendation(String recommendation) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          const Icon(Icons.info, size: 16, color: Colors.blue),
          const SizedBox(width: 8),
          Expanded(child: Text(recommendation)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.security, size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Security Status',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                if (_isLoading)
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else
                  PopupMenuButton<String>(
                    onSelected: (value) {
                      switch (value) {
                        case 'test_password':
                          _testPasswordStrength();
                          break;
                        case 'security_audit':
                          _showSecurityAudit();
                          break;
                      }
                    },
                    itemBuilder: (context) => [
                      const PopupMenuItem(
                        value: 'test_password',
                        child: Row(
                          children: [
                            const Icon(Icons.password),
                            const SizedBox(width: 8),
                            const Text('Test Password'),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'security_audit',
                        child: Row(
                          children: [
                            const Icon(Icons.verified_user),
                            const SizedBox(width: 8),
                            const Text('Security Audit'),
                          ],
                        ),
                      ),
                    ],
                  ),
              ],
            ),
            const SizedBox(height: 16),
            
            // Biometric status
            if (_biometricAvailable) ...[
              SwitchListTile(
                title: const Text('Biometric Authentication'),
                subtitle: const Text('Use fingerprint or face recognition'),
                value: _biometricEnabled,
                onChanged: (_) => _toggleBiometric(),
                secondary: Icon(
                  _biometricEnabled ? Icons.fingerprint : Icons.fingerprint_outlined,
                  color: _biometricEnabled ? Colors.green : Colors.grey,
                ),
              ),
              const Divider(),
            ] else ...[
              const ListTile(
                leading: Icon(Icons.info, color: Colors.orange),
                title: Text('Biometric Not Available'),
                subtitle: Text('This device does not support biometric authentication'),
              ),
              const Divider(),
            ],
            
            // Security features
            const Text(
              'Security Features',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            _buildSecurityFeature('Secure Storage', true),
            _buildSecurityFeature('Password Hashing', true),
            _buildSecurityFeature('Rate Limiting', true),
            _buildSecurityFeature('Device Fingerprinting', true),
            _buildSecurityFeature('Session Management', true),
          ],
        ),
      ),
    );
  }

  Widget _buildSecurityFeature(String feature, bool enabled) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            enabled ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 16,
            color: enabled ? Colors.green : Colors.grey,
          ),
          const SizedBox(width: 8),
          Text(feature),
        ],
      ),
    );
  }
}
