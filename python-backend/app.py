# =========================================
# 🌸 BTP: Real-Time Safe Route Detection API
# Flask Backend for Safe Route Detection
# =========================================

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pandas as pd
import folium
from folium.plugins import HeatMap
import osmnx as ox
import networkx as nx
import math
from geopy.geocoders import Nominatim
import os
import uuid
from datetime import datetime
import traceback

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
MAPS_DIR = "maps"
CRIME_DATA_PATH = ".\data\crime_weighted_output.csv"
CITY_NAME = "Washington, D.C., USA"

# Create maps directory if it doesn't exist
os.makedirs(MAPS_DIR, exist_ok=True)
os.makedirs("data", exist_ok=True)

# Global variables for caching
G = None
df = None
edge_crime_weight = None
score_col = None

def load_crime_data():
    """Load and clean crime data"""
    global df, score_col
    try:
        if not os.path.exists(CRIME_DATA_PATH):
            raise FileNotFoundError(f"Crime data file not found: {CRIME_DATA_PATH}")
        
        df = pd.read_csv(CRIME_DATA_PATH)
        df = df.dropna(subset=["OFFENSE_LATITUDE", "OFFENSE_LONGITUDE"])
        df = df[(df["OFFENSE_LATITUDE"] != 0.0) & (df["OFFENSE_LONGITUDE"] != 0.0)]
        
        print(f"✅ Crime records loaded: {len(df)}")
        
        # Identify crime score column
        score_cols = [col for col in df.columns if "score" in col.lower()]
        if not score_cols:
            raise ValueError("No crime score column found in CSV")
        
        score_col = score_cols[0]
        return df, score_col
    except Exception as e:
        print(f"❌ Error loading crime data: {e}")
        raise

def load_map_graph():
    """Load map graph from OSM"""
    global G
    try:
        print(f"🌍 Loading map graph for {CITY_NAME}...")
        G = ox.graph_from_place(CITY_NAME, network_type="drive")
        print("✅ Map graph loaded.")
        return G
    except Exception as e:
        print(f"❌ Error loading map graph: {e}")
        raise

def map_crimes_to_edges(G, df, score_col):
    """Map crimes to graph edges"""
    global edge_crime_weight
    lats = df["OFFENSE_LATITUDE"].values
    lons = df["OFFENSE_LONGITUDE"].values
    scores = df[score_col].values

    edges = ox.distance.nearest_edges(G, X=lons, Y=lats)
    
    edge_crime_weight = {}
    for edge, score in zip(edges, scores):
        edge_crime_weight[edge] = edge_crime_weight.get(edge, 0) + score
    
    # Normalize and assign weights
    max_crime_w = max(edge_crime_weight.values()) if len(edge_crime_weight) > 0 else 1
    max_dist = max((data.get("length", 1) for _, _, _, data in G.edges(keys=True, data=True)), default=1)

    for u, v, k, data in G.edges(keys=True, data=True):
        crime_w = edge_crime_weight.get((u, v, k), 0)
        
        norm_crime = crime_w / max_crime_w if max_crime_w > 0 else 0
        norm_dist = data.get("length", 1) / max_dist
        
        data["combined_weight"] = 0.6 * norm_crime + 0.4 * norm_dist
        data["crime_weight"] = norm_crime
        data["dist_weight"] = norm_dist

    print("✅ Crime weights assigned to roads.")
    return edge_crime_weight

def initialize_data():
    """Initialize map graph and crime data (call once on startup or first request)"""
    global G, df, score_col, edge_crime_weight
    if G is None:
        load_map_graph()
    if df is None:
        load_crime_data()
        map_crimes_to_edges(G, df, score_col)

def get_location(name):
    """Geocode location name to coordinates"""
    geolocator = Nominatim(user_agent="btp_safety_app")
    try:
        location = geolocator.geocode(name)
        if location:
            print(f"📍 {name}: ({location.latitude:.4f}, {location.longitude:.4f})")
            return (location.latitude, location.longitude)
        else:
            print(f"❌ Location not found: {name}")
            return None
    except Exception as e:
        print(f"❌ Error geocoding {name}: {e}")
        return None

def heuristic(u, v, G):
    """Haversine-based heuristic for A* algorithm"""
    lat1, lon1 = G.nodes[u]['y'], G.nodes[u]['x']
    lat2, lon2 = G.nodes[v]['y'], G.nodes[v]['x']
    return ox.distance.great_circle(lat1, lon1, lat2, lon2)

def calculate_path_stats(path, G):
    """Calculate total distance and crime score for a path"""
    if not path:
        return None, None
    
    total_dist = 0
    total_crime = 0
    
    for i in range(len(path) - 1):
        u, v = path[i], path[i+1]
        edge_data = G.get_edge_data(u, v)
        if edge_data:
            if isinstance(edge_data, dict) and 0 in edge_data:
                edge_data = edge_data[0]
            total_dist += edge_data.get('length', 0)
            total_crime += edge_data.get('crime_weight', 0)
    
    return total_dist / 1000, total_crime  # distance in km

def find_routes(G, source_point, dest_point):
    """Find safest, fastest, and unsafe routes"""
    orig_node = ox.distance.nearest_nodes(G, X=source_point[1], Y=source_point[0])
    dest_node = ox.distance.nearest_nodes(G, X=dest_point[1], Y=dest_point[0])
    
    print(f"✅ Nearest graph nodes found: {orig_node} → {dest_node}")
    
    # Safest path
    safest_path = None
    try:
        safest_path = nx.astar_path(
            G, orig_node, dest_node,
            weight="combined_weight",
            heuristic=lambda u, v: heuristic(u, v, G)
        )
        print(f"✅ Safest path found: {len(safest_path)} nodes")
    except nx.NetworkXNoPath:
        print("❌ No safest path found!")
    
    # Fastest path
    fastest_path = None
    try:
        fastest_path = nx.astar_path(
            G, orig_node, dest_node,
            weight="length",
            heuristic=lambda u, v: heuristic(u, v, G)
        )
        print(f"✅ Fastest path found: {len(fastest_path)} nodes")
    except nx.NetworkXNoPath:
        print("❌ No fastest path found!")
    
    # Unsafe path
    unsafe_path = None
    try:
        unsafe_path = nx.dijkstra_path(
            G, orig_node, dest_node,
            weight=lambda u, v, d: 1.0 / (d.get('crime_weight', 0.01) + 0.01)
        )
        print(f"✅ Unsafe path found: {len(unsafe_path)} nodes")
    except (nx.NetworkXNoPath, ZeroDivisionError):
        print("⚠ Using fastest path as unsafe path")
        unsafe_path = fastest_path
    
    return safest_path, fastest_path, unsafe_path, orig_node, dest_node

def create_map(source_point, dest_point, src_name, dst_name, 
               safest_path, fastest_path, unsafe_path, G, df):
    """Create interactive Folium map"""
    center_lat = (source_point[0] + dest_point[0]) / 2
    center_lon = (source_point[1] + dest_point[1]) / 2
    m = folium.Map(location=[center_lat, center_lon], zoom_start=13)

    # Start/End markers
    folium.Marker(
        source_point,
        tooltip=f"🚀 Start: {src_name}",
        icon=folium.Icon(color="green", icon="play")
    ).add_to(m)

    folium.Marker(
        dest_point,
        tooltip=f"🏁 End: {dst_name}",
        icon=folium.Icon(color="red", icon="stop")
    ).add_to(m)

    # Calculate stats for each path
    safe_dist, safe_crime = calculate_path_stats(safest_path, G) if safest_path else (None, None)
    fast_dist, fast_crime = calculate_path_stats(fastest_path, G) if fastest_path else (None, None)
    unsafe_dist, unsafe_crime = calculate_path_stats(unsafe_path, G) if unsafe_path else (None, None)

    # Safest path (Blue)
    if safest_path:
        safest_coords = [(G.nodes[n]['y'], G.nodes[n]['x']) for n in safest_path]
        folium.PolyLine(
            safest_coords,
            color="blue",
            weight=6,
            opacity=0.8,
            tooltip=f"🛡 Safest Path ({safe_dist:.1f} km, Crime: {safe_crime:.2f})"
        ).add_to(m)

    # Fastest path (Green)
    if fastest_path and fastest_path != safest_path:
        fastest_coords = [(G.nodes[n]['y'], G.nodes[n]['x']) for n in fastest_path]
        folium.PolyLine(
            fastest_coords,
            color="green",
            weight=5,
            opacity=0.7,
            tooltip=f"⚡ Fastest Path ({fast_dist:.1f} km, Crime: {fast_crime:.2f})"
        ).add_to(m)

    # Unsafe path (Red)
    if unsafe_path and unsafe_path != safest_path and unsafe_path != fastest_path:
        unsafe_coords = [(G.nodes[n]['y'], G.nodes[n]['x']) for n in unsafe_path]
        folium.PolyLine(
            unsafe_coords,
            color="red",
            weight=5,
            opacity=0.6,
            tooltip=f"⚠ Most Unsafe Path ({unsafe_dist:.1f} km, Crime: {unsafe_crime:.2f})"
        ).add_to(m)

    # Crime heatmap
    heat_data = df[["OFFENSE_LATITUDE", "OFFENSE_LONGITUDE"]].values.tolist()
    HeatMap(
        heat_data,
        radius=10,
        blur=15,
        min_opacity=0.4,
        max_zoom=13,
        gradient={0.4: 'yellow', 0.65: 'orange', 1: 'red'}
    ).add_to(folium.FeatureGroup(name='Crime Heatmap').add_to(m))

    # Add layer control
    folium.LayerControl().add_to(m)

    # Add legend
    legend_html = '''
    <div style="position: fixed; 
         bottom: 50px; right: 50px; width: 220px; height: 140px; 
         background-color: white; border:2px solid grey; z-index:9999; 
         font-size:14px; padding: 10px">
         <p><strong>Route Legend</strong></p>
         <p><span style="color:blue;">━━━</span> Safest Path (min crime)</p>
         <p><span style="color:green;">━━━</span> Fastest Path (min distance)</p>
         <p><span style="color:red;">━━━</span> Unsafe Path (max crime)</p>
    </div>
    '''
    m.get_root().html.add_child(folium.Element(legend_html))

    return m, safe_dist, safe_crime

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "Safe Route API"})

@app.route('/getSafeRoute', methods=['POST'])
def get_safe_route():
    """Main endpoint for safe route detection"""
    try:
        data = request.get_json()
        source = data.get('source')
        destination = data.get('destination')
        
        if not source or not destination:
            return jsonify({
                "status": "error",
                "message": "Source and destination are required"
            }), 400
        
        print(f"\n🚀 Route request: {source} → {destination}")
        
        # Load data if not already loaded
        initialize_data()
        
        # Geocode locations
        source_point = get_location(source)
        dest_point = get_location(destination)
        
        if not source_point or not dest_point:
            return jsonify({
                "status": "error",
                "message": "Could not geocode one or both locations"
            }), 400
        
        # Find routes
        safest_path, fastest_path, unsafe_path, orig_node, dest_node = find_routes(
            G, source_point, dest_point
        )
        
        if not safest_path:
            return jsonify({
                "status": "error",
                "message": "No route found between the locations"
            }), 404
        
        # Create map
        m, safe_dist, safe_crime = create_map(
            source_point, dest_point, source, destination,
            safest_path, fastest_path, unsafe_path, G, df
        )
        
        # Save map
        map_id = str(uuid.uuid4())
        map_filename = f"safe_route_{map_id}.html"
        map_path = os.path.join(MAPS_DIR, map_filename)
        m.save(map_path)
        
        # Get base URL (you may need to adjust this for your deployment)
        base_url = request.host_url.rstrip('/')
        map_url = f"{base_url}/maps/{map_filename}"
        
        return jsonify({
            "status": "success",
            "safe_path_distance_km": round(safe_dist, 2) if safe_dist else None,
            "crime_score": round(safe_crime, 2) if safe_crime else None,
            "map_url": map_url,
            "map_filename": map_filename
        })
        
    except FileNotFoundError as e:
        return jsonify({
            "status": "error",
            "message": f"Crime data file not found. Please ensure {CRIME_DATA_PATH} exists."
        }), 500
    except Exception as e:
        print(f"❌ Error in get_safe_route: {e}")
        print(traceback.format_exc())
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/getPaths', methods=['POST'])
def get_paths():
    """Endpoint that returns path coordinates for navigation"""
    try:
        data = request.get_json()
        source = data.get('source')
        destination = data.get('destination')
        
        if not source or not destination:
            return jsonify({
                "status": "error",
                "message": "Source and destination are required"
            }), 400
        
        print(f"\n🚀 Path request: {source} → {destination}")
        
        # Load data if not already loaded
        initialize_data()
        
        # Geocode locations
        source_point = get_location(source)
        dest_point = get_location(destination)
        
        if not source_point or not dest_point:
            return jsonify({
                "status": "error",
                "message": "Could not geocode one or both locations"
            }), 400
        
        # Find routes
        safest_path, fastest_path, unsafe_path, orig_node, dest_node = find_routes(
            G, source_point, dest_point
        )
        
        if not safest_path:
            return jsonify({
                "status": "error",
                "message": "No route found between the locations"
            }), 404
        
        # Calculate stats and coordinates for each path
        safe_dist, safe_crime = calculate_path_stats(safest_path, G) if safest_path else (None, None)
        fast_dist, fast_crime = calculate_path_stats(fastest_path, G) if fastest_path else (None, None)
        unsafe_dist, unsafe_crime = calculate_path_stats(unsafe_path, G) if unsafe_path else (None, None)
        
        # Convert node paths to coordinate arrays [lat, lon]
        safest_coords = [[G.nodes[n]['y'], G.nodes[n]['x']] for n in safest_path] if safest_path else []
        fastest_coords = [[G.nodes[n]['y'], G.nodes[n]['x']] for n in fastest_path] if fastest_path else []
        unsafe_coords = [[G.nodes[n]['y'], G.nodes[n]['x']] for n in unsafe_path] if unsafe_path else []
        
        return jsonify({
            "status": "success",
            "safest_path": safest_coords,
            "fastest_path": fastest_coords,
            "unsafe_path": unsafe_coords,
            "safest_distance_km": round(safe_dist, 2) if safe_dist else None,
            "fastest_distance_km": round(fast_dist, 2) if fast_dist else None,
            "unsafe_distance_km": round(unsafe_dist, 2) if unsafe_dist else None,
            "source": source_point,
            "destination": dest_point
        })
        
    except FileNotFoundError as e:
        return jsonify({
            "status": "error",
            "message": f"Crime data file not found. Please ensure {CRIME_DATA_PATH} exists."
        }), 500
    except Exception as e:
        print(f"❌ Error in get_paths: {e}")
        print(traceback.format_exc())
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/maps/<filename>', methods=['GET'])
def serve_map(filename):
    """Serve generated map HTML files"""
    try:
        return send_from_directory(MAPS_DIR, filename)
    except FileNotFoundError:
        return jsonify({"status": "error", "message": "Map not found"}), 404

if __name__ == '__main__':
    print("🌸 Starting Safe Route Detection API...")
    print("⚠️  Note: First request may take time to load map data and crime data.")
    app.run(host='0.0.0.0', port=8000, debug=True)

