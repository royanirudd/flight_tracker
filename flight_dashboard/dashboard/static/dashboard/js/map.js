let map;
let isRotating = false;
let startRotation = 0;
const flightPaths = {};
const flightInitialPositions = {};
let flightMarkers = {};
const MAP_CENTER = [42.3601, -71.0589];  // Boston, Massachusetts coordinates

const createPlaneIcon = (heading = 0) => L.divIcon({
	html: `<div class="plane-icon-wrapper" style="transform: rotate(${heading}deg)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#2196F3">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
            </svg>
           </div>`,
	className: 'plane-icon',
	iconSize: [20, 20],
	iconAnchor: [10, 10]
});

const shipInfo = {
	name: "USS Example",
	type: "Research Vessel",
	callsign: "USEX",
	heading: 145,
	speed: 12.5,
	coordinates: MAP_CENTER
};

function setMapRotation(angle) {
	if (map._bearing === undefined) map._bearing = 0;
	map._bearing = angle;
	map.setBearing(angle);
}

function throttle(func, limit) {
	let inThrottle;
	return function(...args) {
		if (!inThrottle) {
			func.apply(this, args);
			inThrottle = true;
			setTimeout(() => inThrottle = false, limit);
		}
	}
}

document.addEventListener('DOMContentLoaded', function() {
	// Initialize map first
	map = L.map('map', {
		center: MAP_CENTER,
		zoom: 8,
		rotate: true,
		rotateControl: true
	});

	// Add tile layer
	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '© OpenStreetMap contributors'
	}).addTo(map);

	// Define icons
	const boatIcon = L.divIcon({
		html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="#1976D2">
                <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/>
               </svg>`,
		className: 'boat-icon',
		iconSize: [24, 24],
		iconAnchor: [12, 12]
	});

	// Add rotation handlers
	map.on('mousedown', (e) => {
		if (e.originalEvent.ctrlKey) {
			isRotating = true;
			const mapContainer = map.getContainer();
			const rect = mapContainer.getBoundingClientRect();
			const center = {
				x: rect.left + rect.width / 2,
				y: rect.top + rect.height / 2
			};

			startRotation = Math.atan2(
				e.originalEvent.clientY - center.y,
				e.originalEvent.clientX - center.x
			) * 180 / Math.PI;

			map.dragging.disable();
			mapContainer.style.cursor = 'move';
			e.originalEvent.preventDefault();
		}
	});

	document.addEventListener('mousemove', throttle((e) => {
		if (!isRotating) return;

		const mapContainer = map.getContainer();
		const rect = mapContainer.getBoundingClientRect();
		const center = {
			x: rect.left + rect.width / 2,
			y: rect.top + rect.height / 2
		};

		const angle = Math.atan2(
			e.clientY - center.y,
			e.clientX - center.x
		) * 180 / Math.PI;

		const sensitivityFactor = 0.2;
		const rotation = (angle - startRotation) * sensitivityFactor;

		setMapRotation(rotation);

		// Rotate markers
		Object.values(flightMarkers).forEach(marker => {
			const icon = marker.getElement();
			if (icon) {
				icon.style.transform = `rotate(${rotation}deg)`;
			}
		});
	}, 16));

	document.addEventListener('mouseup', () => {
		if (isRotating) {
			isRotating = false;
			map.dragging.enable();
			map.getContainer().style.cursor = '';
		}
	});

	// Add boat marker
	const boatMarker = L.marker(MAP_CENTER, {
		icon: boatIcon,
		zIndexOffset: 1000
	}).addTo(map);

	boatMarker.on('click', () => {
		document.getElementById('flight-info').innerHTML = formatShipInfo();
		updateWeather(MAP_CENTER[0], MAP_CENTER[1]);
	});

	// Add recenter button with rotation reset
	const recenterButton = L.control({ position: 'bottomright' });
	recenterButton.onAdd = function(map) {
		const div = L.DomUtil.create('div', 'recenter-button');
		div.innerHTML = `
            <button title="Center and reset rotation">
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                </svg>
            </button>
        `;

		div.onclick = function() {
			setMapRotation(0);
			map.setView(MAP_CENTER, 8, {
				animate: true,
				duration: 1
			});
		};

		return div;
	};
	recenterButton.addTo(map);

	// Create radius circles
	const radiusCircles = [
		{ radius: 15000, color: '#cc0000' },
		{ radius: 30000, color: '#cc6600' },
		{ radius: 45000, color: '#007E33' },
		{ radius: 60000, color: '#0099cc' }
	].map(circle => L.circle(MAP_CENTER, {
		radius: circle.radius,
		color: circle.color,
		fill: false,
		dashArray: '10, 15',
		weight: 2.5
	}).addTo(map));

	// Add clear paths button
	const clearPathsButton = L.control({ position: 'topright' });
	clearPathsButton.onAdd = function(map) {
		const div = L.DomUtil.create('div', 'clear-paths-button');
		div.innerHTML = `
            <button title="Clear flight paths">
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>
        `;

		div.onclick = function() {
			Object.values(flightPaths).forEach(path => map.removeLayer(path));
			Object.keys(flightPaths).forEach(key => delete flightPaths[key]);
			Object.keys(flightInitialPositions).forEach(key => delete flightInitialPositions[key]);
		};

		return div;
	};
	clearPathsButton.addTo(map);

	// Add styles
	const style = document.createElement('style');
	style.textContent += `
        .clear-paths-button button {
            background: white;
            border: 2px solid rgba(0,0,0,0.2);
            border-radius: 4px;
            padding: 5px;
            cursor: pointer;
        }
        .clear-paths-button button:hover {
            background: #f4f4f4;
        }
        .leaflet-container {
            transition: transform 0.1s;
        }
        .plane-icon-wrapper {
            transition: transform 0.1s;
        }
    `;
	document.head.appendChild(style);

	// Start flight updates
	updateFlights();
	setInterval(updateFlights, 30000);
});

// Helper functions
function formatShipInfo() {
	return `
        <h2>Ship Information</h2>
        <div class="flight-detail"><span>Vessel Name:</span> <span>${shipInfo.name}</span></div>
        <div class="flight-detail"><span>Type:</span> <span>${shipInfo.type}</span></div>
        <div class="flight-detail"><span>Callsign:</span> <span>${shipInfo.callsign}</span></div>
        <div class="flight-detail"><span>Heading:</span> <span>${shipInfo.heading}°</span></div>
        <div class="flight-detail"><span>Speed:</span> <span>${shipInfo.speed} knots</span></div>
        <div class="flight-detail"><span>Position:</span> <span>${shipInfo.coordinates[0].toFixed(4)}, ${shipInfo.coordinates[1].toFixed(4)}</span></div>
    `;
}

function formatFlightInfo(flight) {
	return `
        <div class="flight-detail"><span>Callsign:</span> <span>${flight.callsign || flight[1]}</span></div>
        <div class="flight-detail"><span>Country:</span> <span>${flight.origin_country || flight[2] || 'Unknown'}</span></div>
        <div class="flight-detail"><span>Altitude:</span> <span>${(flight.altitude || flight[7] || 0).toFixed(0)} m</span></div>
        <div class="flight-detail"><span>Speed:</span> <span>${((flight.velocity || flight[9] || 0) * 3.6).toFixed(0)} km/h</span></div>
        <div class="flight-detail"><span>Heading:</span> <span>${(flight.heading || flight[10] || 0).toFixed(0)}°</span></div>
        <div class="flight-detail"><span>Position:</span> <span>${(flight.latitude || flight[6] || 0).toFixed(4)}, ${(flight.longitude || flight[5] || 0).toFixed(4)}</span></div>
    `;
}

// Function to update weather information
async function updateWeather(lat, lon) {
	try {
		const response = await fetch(`/api/weather/?lat=${lat}&lon=${lon}`);
		const data = await response.json();

		if (data.error) {
			throw new Error(data.error);
		}

		const weatherHtml = `
            <div class="flight-detail"><span>Temperature:</span> <span>${data.temperature}</span></div>
            <div class="flight-detail"><span>Feels Like:</span> <span>${data.feels_like}</span></div>
            <div class="flight-detail"><span>Condition:</span> <span>${data.condition}</span></div>
            <div class="flight-detail"><span>Wind Speed:</span> <span>${data.wind_speed}</span></div>
            <div class="flight-detail"><span>Humidity:</span> <span>${data.humidity}</span></div>
            <div class="flight-detail"><span>Pressure:</span> <span>${data.pressure}</span></div>
        `;

		document.querySelector('.weather-data').innerHTML = weatherHtml;
		document.getElementById('weather-info').classList.remove('hidden');
	} catch (error) {
		console.error('Weather update failed:', error);
	}
}

// Function to update flight markers
async function updateFlights() {
	try {
		const bounds = map.getBounds();
		const params = new URLSearchParams({
			north: bounds.getNorth(),
			south: bounds.getSouth(),
			east: bounds.getEast(),
			west: bounds.getWest()
		});

		console.log('Fetching flight data...');
		const response = await fetch(`/api/flights/?${params}`);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		console.log('Received flight data:', data);

		if (!data) {
			throw new Error('No data received from API');
		}

		if (!data.states) {
			throw new Error('No states array in API response');
		}

		if (!Array.isArray(data.states)) {
			throw new Error(`Invalid states data type: ${typeof data.states}`);
		}

		console.log(`Processing ${data.states.length} flights...`);

		const activeFlights = new Set();

		data.states.forEach((flight, index) => {
			try {
				const callsign = flight[1];
				const latitude = flight[6];
				const longitude = flight[5];

				if (!callsign || !latitude || !longitude) return;

				activeFlights.add(callsign);

				const position = [latitude, longitude];

				// Store initial position if this is a new flight
				if (!flightInitialPositions[callsign]) {
					flightInitialPositions[callsign] = position;
				}

				// Update or create flight path
				if (!flightPaths[callsign]) {
					flightPaths[callsign] = L.polyline([flightInitialPositions[callsign]], {
						color: `hsl(${Math.random() * 360}, 70%, 50%)`,
						weight: 2,
						opacity: 0.6
					}).addTo(map);
				}

				// Add new position to path
				const path = flightPaths[callsign];
				const positions = path.getLatLngs();
				positions.push(position);
				path.setLatLngs(positions);

				if (flightMarkers[callsign]) {
					const heading = flight[10] || 0;
					flightMarkers[callsign].setLatLng([latitude, longitude]);
					flightMarkers[callsign].setIcon(createPlaneIcon(heading));
				} else {
					const heading = flight[10] || 0;
					const marker = L.marker([latitude, longitude], {
						icon: createPlaneIcon(heading)
					}).addTo(map);

					marker.on('click', () => {
						document.getElementById('flight-info').innerHTML = formatFlightInfo(flight);
						updateWeather(latitude, longitude);
					});

					flightMarkers[callsign] = marker;
				}
			} catch (flightError) {
				console.error(`Error processing flight at index ${index}:`, flightError);
			}
		});

		Object.keys(flightMarkers).forEach(id => {
			if (!activeFlights.has(id)) {
				if (flightPaths[id]) {
					map.removeLayer(flightPaths[id]);
					delete flightPaths[id];
				}
				if (flightInitialPositions[id]) {
					delete flightInitialPositions[id];
				}
				map.removeLayer(flightMarkers[id]);
				delete flightMarkers[id];
			}
		});

	} catch (error) {
		console.error('Flight update failed:', error);
		console.error('Error details:', {
			name: error.name,
			message: error.message,
			stack: error.stack
		});
	}
}
