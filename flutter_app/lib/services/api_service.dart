import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  // Pi-Backend — auf dem Gerät selbst ist es localhost, extern die Pi-IP
  static const String _baseUrl = 'http://localhost:8000';

  Future<Map<String, dynamic>> get(String path) async {
    final response = await http.get(Uri.parse('$_baseUrl$path'));
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    throw Exception('API GET $path: ${response.statusCode}');
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final response = await http.post(
      Uri.parse('$_baseUrl$path'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(body),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    throw Exception('API POST $path: ${response.statusCode}');
  }
}
