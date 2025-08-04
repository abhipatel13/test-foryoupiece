// Test script for pagination API
const fetch = require('node-fetch');

async function testPaginationAPI() {
  const baseUrl = 'http://localhost:3001';
  
  console.log('🧪 Testing Pagination API...\n');
  
  // Test 1: Basic pagination
  console.log('Test 1: Basic pagination (page 1, limit 5)');
  try {
    const response = await fetch(`${baseUrl}/api/admin/users/list?page=1&limit=5`);
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('---\n');
  } catch (error) {
    console.error('Error:', error.message);
    console.log('---\n');
  }
  
  // Test 2: Search functionality
  console.log('Test 2: Search functionality');
  try {
    const response = await fetch(`${baseUrl}/api/admin/users/list?page=1&limit=5&search=akito`);
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('---\n');
  } catch (error) {
    console.error('Error:', error.message);
    console.log('---\n');
  }
  
  // Test 3: Filter by tier
  console.log('Test 3: Filter by tier');
  try {
    const response = await fetch(`${baseUrl}/api/admin/users/list?page=1&limit=5&tier=bronze`);
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('---\n');
  } catch (error) {
    console.error('Error:', error.message);
    console.log('---\n');
  }
  
  // Test 4: Large page number (edge case)
  console.log('Test 4: Large page number (edge case)');
  try {
    const response = await fetch(`${baseUrl}/api/admin/users/list?page=999&limit=5`);
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('---\n');
  } catch (error) {
    console.error('Error:', error.message);
    console.log('---\n');
  }
}

testPaginationAPI().catch(console.error);
