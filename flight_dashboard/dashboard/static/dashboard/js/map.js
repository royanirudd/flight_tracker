const boatIcon = L.divIcon({
	html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="#1976D2">
            <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/>
           </svg>`,
	className: 'boat-icon',
	iconSize: [24, 24],
	iconAnchor: [12, 12]
});

const MAP_CENTER = [42.3601, -71.0589];  // Boston, Massachusetts coordinates
const map = L.map('map').setView(MAP_CENTER, 8);  // Adjusted zoom level

let boatMarker;

// Ship information
const shipInfo = {
	name: "USS Example",
	type: "Research Vessel",
	callsign: "USEX",
	heading: 145,
	speed: 12.5,
	coordinates: MAP_CENTER
};

// Function to format ship information
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

boatMarker = L.marker(MAP_CENTER, {
	icon: boatIcon,
	zIndexOffset: 1000  // Keep boat on top of other markers
}).addTo(map);

boatMarker.on('click', () => {
	document.getElementById('flight-info').innerHTML = formatShipInfo();
	updateWeather(MAP_CENTER[0], MAP_CENTER[1]);
});

// recenter button
const recenterButton = L.control({ position: 'bottomright' });

recenterButton.onAdd = function(map) {
	const div = L.DomUtil.create('div', 'recenter-button');
	div.innerHTML = `
        <button title="Center on vessel">
            <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
            </svg>
        </button>
    `;

	div.onclick = function() {
		map.setView(MAP_CENTER, 8, {
			animate: true,
			duration: 1
		});
	};

	return div;
};

recenterButton.addTo(map);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Create object to store markers
let flightMarkers = {};

// Create radius circles
const radiusCircles = [
	{ radius: 15000, color: '#cc0000' },  // 15km
	{ radius: 30000, color: '#cc6600' },  // 30km
	{ radius: 45000, color: '#007E33' },  // 45km
	{ radius: 60000, color: '#0099cc' }   // 60km
].map(circle => L.circle(MAP_CENTER, {
	radius: circle.radius,
	color: circle.color,
	fill: false,
	dashArray: '10, 15',
	weight: 2.5
}).addTo(map));

//  airplane icon
const planeIcon = L.divIcon({
	html: `<div class="plane-icon-wrapper">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#2196F3">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
            </svg>
           </div>`,
	className: 'plane-icon',
	iconSize: [20, 20],
	iconAnchor: [10, 10]
});

// Function to format flight information
function formatFlightInfo(flight) {
	return `
        <div class="flight-detail"><span>Callsign:</span> <span>${flight.callsign}</span></div>
        <div class="flight-detail"><span>Country:</span> <span>${flight.origin_country}</span></div>
        <div class="flight-detail"><span>Altitude:</span> <span>${flight.altitude}</span></div>
        <div class="flight-detail"><span>Speed:</span> <span>${flight.velocity}</span></div>
        <div class="flight-detail"><span>Heading:</span> <span>${flight.heading}</span></div>
        <div class="flight-detail"><span>Position:</span> <span>${flight.lat.toFixed(4)}, ${flight.lon.toFixed(4)}</span></div>
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

		data.states.forEach((flightData, index) => {
			try {
				if (!flightData || flightData.length < 7) {
					console.warn(`Skipping flight at index ${index}: insufficient data`);
					return;
				}

				const callsign = flightData[1] ? flightData[1].trim() : null;
				const latitude = parseFloat(flightData[6]);
				const longitude = parseFloat(flightData[5]);

				if (!callsign || !latitude || !longitude) {
					console.warn(`Skipping flight ${callsign}: missing coordinates`, {
						callsign,
						latitude,
						longitude
					});
					return;
				}

				console.log(`Processing flight ${callsign}:`, {
					lat: latitude,
					lon: longitude,
					alt: flightData[7],
					speed: flightData[9],
					heading: flightData[10]
				});

				const flight = {
					callsign: callsign,
					origin_country: flightData[2] || 'Unknown',
					altitude: Math.round(flightData[7] || 0) + " m",
					velocity: Math.round((flightData[9] || 0) * 3.6) + " km/h", // Convert m/s to km/h
					heading: Math.round(flightData[10] || 0) + "°",
					lat: latitude,
					lon: longitude
				};

				activeFlights.add(callsign);

				if (flightMarkers[callsign]) {
					flightMarkers[callsign].setLatLng([latitude, longitude]);
				} else {
					const marker = L.marker([latitude, longitude], {
						icon: planeIcon
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
				console.log(`Removing stale flight: ${id}`);
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

// Update flights every 15 seconds
setInterval(updateFlights, 30000);

// Initial update
updateFlights();

const style = document.createElement('style');
style.textContent = `
    .plane-icon svg {
        transition: transform 0.5s ease-in-out;
    }
`;
document.head.appendChild(style);
