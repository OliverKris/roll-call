def test_health_returns_service_identity(client):
    r = client.get("/health")

    assert r.status_code == 200
    assert r.json() == {"status": "healthy", "service": "catalog"}
