#!/bin/bash

echo "=== RAG System Testing Script ==="
echo ""

# Create test document
echo "Creating test document..."
cat > test_document.txt << EOF
This is a comprehensive guide about artificial intelligence.

Machine Learning is a subset of AI that enables computers to learn and improve from experience without being explicitly programmed. There are three main types:

1. Supervised Learning: Uses labeled training data
2. Unsupervised Learning: Finds patterns in unlabeled data
3. Reinforcement Learning: Learns through interaction with environment

Deep Learning is a specialized form of machine learning that uses neural networks with multiple layers. It's particularly effective for:
- Image recognition
- Natural language processing
- Speech recognition
- Autonomous vehicles

Recent advances include transformer models, which have revolutionized NLP tasks.
EOF

echo "✅ Test document created"
echo ""

# Test document upload
echo "Testing document upload..."
upload_response=$(curl -s -X POST "http://127.0.0.1:8000/admin/upload" \
  -H "Authorization: Bearer your-secure-admin-token-here" \
  -F "file=@test_document.txt")

echo "Upload response: $upload_response"
echo ""

# Test document listing
echo "Testing document listing..."
list_response=$(curl -s "http://127.0.0.1:8000/admin/documents" \
  -H "Authorization: Bearer your-secure-admin-token-here")

echo "Documents list: $list_response"
echo ""

# Test unauthorized access
echo "Testing unauthorized access..."
unauth_response=$(curl -s "http://127.0.0.1:8000/admin/documents")
echo "Unauthorized response: $unauth_response"
echo ""

echo "=== Manual Tests ==="
echo "1. Open http://localhost:3001 in your browser"
echo "2. Ask: 'What is machine learning?' (should use uploaded document)"
echo "3. Ask: 'What are the latest AI developments?' (should use web search)"
echo "4. Ask: 'Tell me about deep learning and recent advances' (should use hybrid)"
echo ""

# Cleanup
echo "Cleaning up test file..."
rm -f test_document.txt
echo "✅ Test completed"