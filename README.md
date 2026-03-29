# 🌸 SOS and Safe Route Detection 

Flask-based REST API for real-time safe route detection using crime data, OSMnx, and NetworkX.

## Features

- 🛡️ **Safest Route**: Minimizes crime exposure while considering distance
- ⚡ **Fastest Route**: Shortest distance path
- ⚠️ **Unsafe Route**: Route through high-crime areas (for comparison)
- 🗺️ **Interactive Maps**: Folium-generated HTML maps with heatmaps and route visualization
- 📊 **Crime Heatmap**: Visual representation of crime hotspots

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Crime data CSV file with the following columns:
  - `OFFENSE_LATITUDE`
  - `OFFENSE_LONGITUDE`
  - At least one column with "score" in the name (for crime scoring)

## Installation

1. **Navigate to the backend directory:**
   ```bash
   cd python-backend
   ```

2. **Create a virtual environment (recommended):**
   ```bash
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Prepare crime data:**
   - Place your crime data CSV file in the `data/` directory
   - Ensure it's named `crime_weighted_output.csv` (or update `CRIME_DATA_PATH` in `app.py`)
   - The CSV should contain:
     - `OFFENSE_LATITUDE`: Latitude of crime incidents
     - `OFFENSE_LONGITUDE`: Longitude of crime incidents
     - At least one column with "score" in the name (e.g., `crime_score`, `weighted_score`)

## Configuration

Edit `app.py` to configure:

- `CRIME_DATA_PATH`: Path to your crime data CSV file (default: `"data/crime_weighted_output.csv"`)
- `CITY_NAME`: City name for OSMnx map download (default: `"Washington, DC"`)
- `MAPS_DIR`: Directory to store generated map HTML files (default: `"maps"`)

## Running the Server

1. **Start the Flask server:**
   ```bash
   python app.py
   ```

2. **The server will start on:**
   - Default: `http://0.0.0.0:8000`
   - Local access: `http://localhost:8000`

3. **Note:** The first request will take longer as it needs to:
   - Download the city map graph from OpenStreetMap
   - Load and process crime data
   - Map crimes to road edges

## API Endpoints

### 1. Health Check
```
GET /health
```
Returns server health status.

**Response:**
```json
{
  "status": "healthy",
  "service": "Safe Route API"
}
```

### 2. Get Safe Route
```
POST /getSafeRoute
```

**Request Body:**
```json
{
  "source": "near **Anacostia / southeast Washington, DC",
  "destination": "Washington, DC"
}
```

**Success Response:**
```json
{
  "status": "success",
  "safe_path_distance_km": 12.4,
  "crime_score": 0.18,
  "map_url": "http://localhost:8000/maps/safe_route_abc123.html",
  "map_filename": "safe_route_abc123.html"
}
```

**Error Response:**
```json
{
  "status": "error",
  "message": "Error description here"
}
```

### 3. Serve Map
```
GET /maps/<filename>
```
Serves generated map HTML files.

## Usage Example

### Using curl:
```bash
curl -X POST http://localhost:8000/getSafeRoute \
  -H "Content-Type: application/json" \
  -d '{
    "source": "near **Anacostia / southeast Washington, DC",
    "destination": "Washington, DC"
  }'
```

### Using Python requests:
```python
import requests

response = requests.post(
    "http://localhost:8000/getSafeRoute",
    json={
        "source": "near **Anacostia / southeast Washington, DC",
        "destination": "Washington, DC"
    }
)

data = response.json()
print(data["map_url"])
```

## Troubleshooting

### Issue: "Crime data file not found"
- **Solution:** Ensure the crime data CSV file exists in the `data/` directory
- Check the file path in `app.py` (`CRIME_DATA_PATH`)

### Issue: "No crime score column found"
- **Solution:** Ensure your CSV has at least one column with "score" in its name
- Example column names: `crime_score`, `weighted_score`, `risk_score`

### Issue: "Could not geocode location"
- **Solution:** Use more specific location names (include city, state, country)
- Example: "Connaught Place, Delhi, India" instead of "Connaught Place"

### Issue: "No route found between locations"
- **Solution:** Ensure both locations are within the city boundaries specified in `CITY_NAME`
- The locations must be accessible by road network

### Issue: Slow first request
- **This is normal!** The first request downloads the city map and processes crime data
- Subsequent requests will be much faster as data is cached

## Development

### Project Structure
```
python-backend/
├── app.py              # Main Flask application
├── requirements.txt    # Python dependencies
├── README.md          # This file
├── data/              # Crime data CSV files
│   └── crime_weighted_output.csv
└── maps/              # Generated map HTML files (created automatically)
```

### Adding New Cities

To use a different city:

1. Update `CITY_NAME` in `app.py`:
   ```python
   CITY_NAME = "Mumbai, India"
   ```

2. Ensure your crime data covers the new city area

3. Restart the server (map graph will be downloaded on first request)

## License

This project is part of the BTP (B.Tech Project) Safe Route Detection System.


