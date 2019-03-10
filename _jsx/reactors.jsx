var React = require('react');

var ReactDOM = require('react-dom');


var L = require('leaflet');
L.Icon.Default.imagePath = '/static/vender/leaflet/images/';

var d3 = require('d3');

var Col = require('react-bootstrap/lib/Col');

var Button = require('react-bootstrap/lib/Button');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');
var Tabs = require('react-bootstrap/lib/Tabs');
var Tab = require('react-bootstrap/lib/Tab');
var Panel = require('react-bootstrap/lib/Panel');
var Table = require('react-bootstrap/lib/Table');

var Form = require('react-bootstrap/lib/Form');
var FormGroup = require('react-bootstrap/lib/FormGroup');
var FormControl = require('react-bootstrap/lib/FormControl');
var ControlLabel = require('react-bootstrap/lib/ControlLabel');
var Checkbox = require('react-bootstrap/lib/Checkbox');
var InputGroup = require('react-bootstrap/lib/InputGroup');

var nu_spectrum = require("./spectrum.js").default;
var osc = require("./nuosc.js");

var detectorPositionUpdate = new Event("detectorPosition");
var spectrumUpdate = new Event("spectrumUpdate");
var mouseFollow = new Event("mouseFollow");
var invertedMassEvent = new Event("invertedMass");
var geoneutrinoEvent = new Event("geoneutrinos");
var loadFactorEvent = new Event("loadFactor");
var customReactorEvent = new Event("customReactorEvent");
var powerOverrideEvent = new Event("powerOverrideEvent");
var useMaxPowerEvent = new Event("useMaxPowerEvent");

import {
  DEG_TO_RAD
} from './config';

import * as Constants from './config';

import { corelist, ReactorCore } from './reactor_db';

import projector from 'ecef-projector';
import download from 'downloadjs';


// Global State Variables
var detectorPosition = {
  "lat": 54.555129,
  "lon": -0.800890,
  "elevation": -1050,
};

var followMouse = false;

var loadFactor = {
  ystart: "2017",
  yend: "2017",
  mstart: "01",
  mend: "12",
};

var invertedMass = false;


var useMaxPower = false;
var powerOverrides = {
  min: [],
  max: []
};

var customReactor = {
  'lat': 0,
  'lon': 0,
  'power': 0, //mw
  'uncertainty': 0, //kms
  'use': false,
  'type': "LEU"
}

var geoneutrinos = {
  'mantleSignal': 8.2, //TNU
  'thuRatio': 3.9, //unitless
  'crustSignal': true
}

var spectrum = {
  'total': null,
  'iaea': null,
  'closest': null,
  'custom': null,
  'geo_u': null,
  'geo_th': null,
}

var distances = {
  'closest': null,
  'user': null,
}


// call once to initialize the current operating powers
updateLoadFactor(loadFactor);

var customReactorMarker = L.circle([customReactor.lat, customReactor.lon], customReactor.uncertainty * 1000);

// end Global State
// Global State Updating Functions (mostly to do event bookkeeping)

function updateDetectorPosition(lon, lat, elevation){
    detectorPosition.lat = parseFloat(lat);
    detectorPosition.lon = parseFloat(lon);
    detectorPosition.elevation = parseFloat(elevation);
    if (detectorPosition.lat > 90){
      detectorPosition.lat = 90;
    }
    if (detectorPosition.lat < -90){
      detectorPosition.lat = -90;
    }
    if (detectorPosition.lon > 180){
      detectorPosition.lon = 180;
    }
    if (detectorPosition.lon < -180){
      detectorPosition.lon = -180;
    }
  if (isNaN(detectorPosition.elevation)){
    detectorPosition.elevation = 0;
  }
  console.log(detectorPosition)
    window.dispatchEvent(detectorPositionUpdate);
}

function updatePowerOverride(min=[], max=[]){
  powerOverrides.min = min;
  powerOverrides.max = max;
  window.dispatchEvent(powerOverrideEvent);
}

function updateUseMaxPower(val){
  useMaxPower = val
  window.dispatchEvent(useMaxPowerEvent);
}

function updateFollowMouse(state){
  if (typeof(state) === "boolean"){
    followMouse = state;
  } else {
    followMouse = !followMouse;
  }
  window.dispatchEvent(mouseFollow);
}

function updateInvertedMass(state){
  if (typeof(state) === "boolean"){
    invertedMass = state;
  } else {
    invertedMass = !invertedMass;
  }
  window.dispatchEvent(invertedMassEvent);
}

function updateSpectrum(newSpectrum){
  spectrum = newSpectrum;
  window.dispatchEvent(spectrumUpdate);
}

function updateGeoneutrinos(obj){
  Object.assign(geoneutrinos, obj);
  if (geoneutrinos.mantleSignal < 0){
    geoneutrinos.mantleSignal = 0;
  }
  if (geoneutrinos.thuRatio < 0){
    geoneutrinos.thuRatio = 0;
  }
  window.dispatchEvent(geoneutrinoEvent);
}

function updateLoadFactor(newLoadFactor){
  loadFactor = Object.assign(loadFactor, newLoadFactor);
  const dtstart = new Date(`${loadFactor.ystart}-${loadFactor.mstart}`);
  const dtend = new Date(`${loadFactor.yend}-${loadFactor.mend}`);
  corelist.forEach((core) => {
    core.operatingPower = core.power * core.loadFactor(dtstart, dtend);
  });
  window.dispatchEvent(loadFactorEvent);
}

function updateCustomReactor(obj){
  Object.assign(customReactor, obj);
  window.dispatchEvent(customReactorEvent);
}

var detectorPresets = [
	{
		"optgroup": "Asia",
    "children": [
        {value:"35.05,126.70",label:"Guemseong (950 mwe)"},
        {value:"9.95,77.28",  label:"INO (3000 mwe)"},
        {value:"22.12,112.51",label:"Jiangmen (2100 mwe)"},
        {value:"28.15,101.71",label:"Jinping (6720 mwe)"},
        {value:"36.42,137.30",label:"Kamioka (2050 mwe)"},
        {value:"51.771,104.398",label:"Lake Baikal (1100 mwe)"}
    ]
	},
	{
		"optgroup": "Europe",
    "children": [
      {value:"43.24,42.70",label:"Baksan (4900 mwe)"},
      {value:"54.555129,-0.80089",label:"Boulby (2805 mwe)"},
      {value:"42.77,-0.56",label:"Canfranc (2450 mwe)"},
      {value:"45.14,6.69" ,label:"Fréjus (4200 mwe)"},
      {value:"42.45,13.58",label:"LNGS (3100 mwe)"},
      {value:"63.66,26.04",label:"Pyhäsalmi (4000 mwe)"}
    ]
	},
	{
		"optgroup": "Mediterranean Sea",
    "children": [
      {value:"42.80,6.17",label:"Antares (2500 mwe)"},
      {value:"36.63,21.58",label:"Nestor (4000 mwe)"},
      {value:"37.551,15.384",label:"NEMO Test (2080 mwe)"}
    ]
  },
	{
		"optgroup": "North America",
    "children": [
      {value:"41.75,-81.29" ,label:"IMB (1570 mwe)"},
      {value:"37.38,-80.66" ,label:"KURF (1400 mwe)"},
      {value:"47.82,-92.24" ,label:"Soudan (1950 mwe)"},
      {value:"44.36,-103.76",label:"SURF (4300 mwe)"},
      {value:"32.37,-103.79",label:"WIPP (1600 mwe)"},
      {value:"46.47,-81.20" ,label:"SNOLAB (6010 mwe)"}
    ]
  },
	{
		"optgroup": "Oceania",
    "children": [
      {value:"-37.07,142.81", label:"SUPL (2700 mwe)"}
    ]
  },
	{
		"optgroup": "Pacific Ocean",
    "children": [
      {value:"22.75,-158.00", label:"ACO (4800 mwe)"},
      {value:"36.71,-122.19", label:"MARS (890 mwe)"}
    ]
  },
	{
		"optgroup": "South America",
    "children": [
      {value:"-30.25,-69.88", label:"ANDES (4200 mwe)"}
    ]
  }
];

// Just map things

var reactorCircles = corelist.map(function(core){
  let style = {"radius": 250, "color": "#009000"};
  if (core.spectrumType == 'PHWR'){
    style = {
        "radius": 250, 
        "color": "#ff0000",
      }
  }
  if (core.spectrumType == 'GCR'){
    style = {
        "radius": 250, 
        "color": "#D69537",
      }
  }
  if (core.spectrumType == 'LEU_MOX'){
    style = {
        "radius": 250, 
        "color": "#00f",
      }
  }
  return L.circle([core.lat, core.lon], 
    style
  ).bindPopup(
    `<b>Core Name:</b> ${core.name}<br />
    <b>Design Power:</b> ${core.power} MW<br />
    <b>Position (N,E) </b> ${core.lat}, ${core.lon}<br />
    <b>Elevation</b> ${core.elevation} m<br />
    <b>Type:</b> ${core.type}
    <b>Mox:</b> ${core.mox}<br />
    <small>Elevation is height above the WGS84 reference ellipsoid</small>
    `
  );
});

var detectorLocations = []

detectorPresets.forEach(function(item){
  item.children.forEach(function(detector){
    detectorLocations.push({
      lat: parseFloat(detector.value.split(',')[0]),
      lon: parseFloat(detector.value.split(',')[1]),
      name: detector.label
    })
  });
});

const detectorCircles = detectorLocations.map(function(data){
  return L.circle([data.lat, data.lon], {"radius": 250, "color": "#9d00ff"}).bindPopup(data.name);
});


var map = L.map('map_container', {worldCopyJump:true}).setView([0, 0], 1);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

L.control.layers(null, {
  "Reactors": L.layerGroup(reactorCircles),
  "Detectors": L.layerGroup(detectorCircles),
}).addTo(map);




function distance(p1, p2){
  var dx = p1.x - p2.x;
  var dy = p1.y - p2.y;
  var dz = p1.z - p2.z;

  var dx2 = Math.pow(dx, 2);
  var dy2 = Math.pow(dy, 2);
  var dz2 = Math.pow(dz, 2);

  return Math.sqrt(dx2 + dy2 + dz2);
}

function squish_array(two_d_array){
  var output = new Array(two_d_array[0].length);
  for (var i=0; i < output.length; i++){
    output[i] = 0;
  }

  for (var i=0; i < two_d_array.length; i++){
    for (var ii=0; ii < output.length; ii++){
      output[ii] += two_d_array[i][ii];
    }
  }
  return output;
}

function tof11(elm){
  return (elm/1000).toFixed(11);
}

function updateSpectrums(){
  // we want to find the smallest element, so start someplace big...
  var min_dist = 1e10;
  var min_spec;
  var react_spectrum = [];
  var p1 = projector.project(detectorPosition.lat, detectorPosition.lon, detectorPosition.elevation).map((n) => n /1000);
  p1 = {
    x: p1[0],
    y: p1[1],
    z: p1[2],
  }

  var geo_nu_spectra = osc.geo_nu(detectorPosition.lat, detectorPosition.lon, geoneutrinos.mantleSignal, geoneutrinos.thuRatio, invertedMass, geoneutrinos.crustSignal);

  corelist.forEach((core) => {
    var power = core.operatingPower;
    const dist = distance(p1, core);
    core.dist = dist;

    if (useMaxPower && power > 0){
      power = core.power;
    }

    if (powerOverrides.min.includes(core.name)){
      power = 0;
    }
    if (powerOverrides.max.includes(core.name)){
      power = core.power;
    }

    var spec = osc.nuosc(dist, power, core.spectrum, invertedMass, true);
    react_spectrum.push(spec);
    if ((dist < min_dist) && (d3.sum(spec) > 0)){
      min_dist = dist;
      min_spec = spec;
    }

  });

  var user_power = 0;
  if (customReactor.use){
    user_power = customReactor.power;
    d3.selectAll(".reac").style("display", "");
  } else {
    d3.selectAll(".reac").style("display", "none");
  }
  var userReactor = new ReactorCore("custom_reactor", "UN", customReactor.lat, customReactor.lon, customReactor.type, 0, user_power)
  var user_dist = distance(p1, userReactor);
  var user_react_spectrum = osc.nuosc(user_dist, userReactor.power, userReactor.spectrum, invertedMass, true);

  var user_spec = squish_array([user_react_spectrum]);
  var iaea = squish_array([squish_array(react_spectrum)]);
  distances.closest = min_dist;
  distances.user = user_dist;
  updateSpectrum({
    closest: min_spec,
    geo_u: geo_nu_spectra.u_spec,
    geo_th: geo_nu_spectra.th_spec,
    iaea: iaea,
    custom: user_spec,
    total:  squish_array([squish_array(react_spectrum), user_spec, geo_nu_spectra.u_spec, geo_nu_spectra.th_spec])
  });
};

window.addEventListener("detectorPosition", updateSpectrums);
window.addEventListener("invertedMass", updateSpectrums);
window.addEventListener("geoneutrinos", updateSpectrums);
window.addEventListener("loadFactor", updateSpectrums);
window.addEventListener("customReactorEvent", updateSpectrums);
window.addEventListener("powerOverrideEvent", updateSpectrums);
window.addEventListener("useMaxPowerEvent", updateSpectrums);

// On Map Detector Marker
var detectorMarker = L.marker(detectorPosition);
detectorMarker.addTo(map);
window.addEventListener("detectorPosition", function(){
  detectorMarker.setLatLng(detectorPosition);
});





function follow_mouse(e){
  if (!followMouse){
    return;
  }
  var xy = e.latlng;
  while (xy.lng > 180){
    xy.lng = xy.lng - 360;
  }
  while (xy.lng < -180){
    xy.lng = xy.lng + 360;
  }

  updateDetectorPosition(xy.lng.toFixed(2), xy.lat.toFixed(2));
}
map.on("mousemove", follow_mouse);
map.on("click", updateFollowMouse);
map.on("dragstart", function(e){map.off("mousemove", follow_mouse)});
map.on("dragend", function(e){map.on("mousemove", follow_mouse)});


function customReactorMarkerUpdator(){
  function getRandomOffset(uncertainty){ //kms
    uncertainty = uncertainty * Math.sqrt(2);
    return (Math.random() * (2 * uncertainty) - uncertainty) / 200;
  }
  if (customReactor.use){
    var radius = customReactor.uncertainty * 1000;
    if (radius < 1000){
      radius = 1000;
    }
    customReactorMarker.setRadius(radius);
    customReactorMarker.setLatLng([customReactor.lat + getRandomOffset(customReactor.uncertainty), customReactor.lon + getRandomOffset(customReactor.uncertainty)]);
    customReactorMarker.addTo(map);
  } else {
    map.removeLayer(customReactorMarker);
  }
}

window.addEventListener("customReactorEvent", customReactorMarkerUpdator);


function use_nav_pos(){
  navigator.geolocation.getCurrentPosition(function(pos){
    updateDetectorPosition(pos.coords.longitude, pos.coords.latitude)
})};

var Plot = React.createClass({
  resize: function(){
    // update width
    var width = parseInt(d3.select(this._div).style('width'), 10);
    width = width - this._margin.left - this._margin.right;

    // reset x range
    this._x.range([0, width]);

    // do the actual resize...
    d3.select(this._svg.node().parentNode)
      .style('width', (width + this._margin.left + this._margin.right) + 'px');

    this._svg.selectAll('.x.label')
      .attr('x', width);

    this._svg.select(".x.axis")
      .call(this._xAxis);

    this._svg.selectAll('rect.background')
      .attr('width', width);
    this._le.attr("transform", "translate(" + (width - 40) + ",0)");

    // redraw the spectrum so it is accurate
    this.updateLines();

  },
  updateLines: function(){
    function for_plot(arr){
      arr = arr.slice(100,899);
      arr.push(0);
      return arr;
    }

    this._x.domain([0, d3.max(spectrum.total, function(d, i) { return i; })- 200]);
    this._y.domain([0, d3.max(spectrum.total, function(d) { return d; })]);
    this._svg.select(".reac")
      .attr("d", this._valueline(for_plot(spectrum.custom)));
    this._svg.select(".c_reac")
      .attr("d", this._valueline(for_plot(spectrum.closest)));
    this._svg.select(".geo_u")
      .attr("d", this._valueline(spectrum.geo_u.slice(100,900)));
    this._svg.select(".geo_th")
      .attr("d", this._valueline(spectrum.geo_th.slice(100,900)));
    this._svg.select(".total")
      .attr("d", this._valueline(for_plot(spectrum.total)));
    this._svg.select(".iaea")
      .attr("d", this._valueline(for_plot(squish_array([spectrum.iaea, spectrum.custom]))));
    this._svg.select("#yaxis")
      .call(this._yAxis);
    this._svg.select(".x.axis")
      .call(this._xAxis);
  },
  componentWillUnmount: function(){
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("spectrumUpdate", this.updateLines);
  },
  componentDidMount: function(){
    window.addEventListener("resize", this.resize);
    window.addEventListener("spectrumUpdate", this.updateLines);
    // Set the dimensions of the graph
    this._margin = {top: 30, right: 20, bottom: 40, left: 50},
        this._width = parseInt(d3.select(this._div).style('width'), 10) - this._margin.left - this._margin.right,
        this._height = 270 - this._margin.top - this._margin.bottom;
    
    // Set the ranges
    this._x = d3.scaleLinear().range([0, this._width]);
    this._y = d3.scaleLinear().range([this._height, 0]);
    
    // Define the axes
    this._xAxis = d3.axisBottom(this._x)
      .ticks(8).tickFormat(function(d) {return ((d/100)+1).toFixed(0)});
    
    this._yAxis = d3.axisLeft(this._y)
      .ticks(5).tickFormat(function(d) {return (d)});
    
      // Define the line
    var x = this._x;
    var y = this._y;
    this._valueline = d3.line()
      .x(function(d, i) { return x(i); })
      .y(function(d) { return y(d); });
    
      // Adds the svg canvas
      this._svg = d3.select(this._div)
      .append("svg")
      .attr("width", this._width + this._margin.left + this._margin.right)
      .attr("height", this._height + this._margin.top + this._margin.bottom)
      .append("g")
      .attr("transform", 
          "translate(" + this._margin.left + "," + this._margin.top + ")");
    
    this._svg.append("path")
    .attr("class", "total line");
    
    this._svg.append("path")
    .attr("class", "iaea line");
    
    this._svg.append("path")
    .attr("class", "c_reac line");
    
    this._svg.append("path")
    .attr("class", "geo_u line");
    this._svg.append("path")
    .attr("class", "geo_th line");
    
    this._svg.append("path")
    .attr("class", "reac line");
    
    
    // Add the X Axis
    this._svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + this._height + ")")
    .call(this._xAxis);
    
    // Add the Y Axis
    this._svg.append("g")
    .attr("class", "y axis")
    .attr("id", "yaxis")
    .call(this._yAxis);
    
    // Add the axis labels
    this._svg.append("text")
    .attr("class", "y label")
    .attr("text-anchor", "end")
    .style("font-size", "15px")
    .attr("y", -50)
    .attr("dy", ".75em")
    .attr("transform", "rotate(-90)")
    .text("Rate dR/dE (TNU/MeV)");

    this._svg.append("text")
    .attr("class", "x label")
    .attr("stroke", "none")
    .attr("fill", "grey")
    .attr("text-anchor", "end")
    .style("font-size", "10px")
    .attr("x", this._width)
    .attr("y", this._height - 4)
    .text("geoneutrinos.org");

    this._svg.append("text")
    .attr("class", "x label")
    .attr("text-anchor", "end")
    .style("font-size", "15px")
    .attr("x", this._width)
    .attr("y", this._height + 33)
    .text("Antineutrino Energy E (MeV)");

    
    this._le = this._svg.append("g")
    .attr("transform", "translate(" + (this._width - 0) + ",0)");

    var le = this._le;
    
    
    le.append("text")
    .attr("text-anchor", "end")
    .attr("x", "-2.1em")
    .attr("y", "0.3em")
    .text("Total");
    le.append("text")
    .attr("text-anchor", "end")
    .attr("x", "-2.1em")
    .attr("y", "2.5em")
    .text("Closest Reactor");
    le.append("text")
    .attr("text-anchor", "end")
    .attr("x", "-2.1em")
    .attr("y", "1.5em")
    .text("Reactors");
    le.append("text")
    .attr("text-anchor", "end")
    .attr("x", "-2.1em")
    .attr("y", "3.5em")
    .text("Geoneutrinos");
    le.append("text")
    .attr("text-anchor", "end")
    .attr("x", "-2.1em")
    .attr("y", "4.5em")
    .text("Uranium");
    le.append("text")
    .attr("text-anchor", "end")
    .attr("x", "-2.1em")
    .attr("y", "5.5em")
    .text("Thorium");
    le.append("text")
    .attr("text-anchor", "end")
    .attr("class", "reac")
    .attr("x", "-2.1em")
    .attr("y", "6.6em")
    .style("display", "none")
    .text("User Reactor");
    
    le.append("line")
    .attr("x1", "-1.9em")
    .attr("x2", "0")
    .attr("y1", "0")
    .attr("y2", "0")
    .attr("stroke-width", 2)
    .style("stroke", "#000");
    le.append("line")
    .attr("x1", "-1.9em")
    .attr("x2", "0")
    .attr("y1", "5.2em")
    .attr("y2", "5.2em")
    .attr("stroke-width", 2)
    .style("stroke", "red");
    le.append("line")
    .attr("x1", "-1.9em")
    .attr("x2", "0")
    .attr("y1", "4.2em")
    .attr("y2", "4.2em")
    .attr("stroke-width", 2)
    .style("stroke", "blue");
    
    le.append("rect")
    .attr("width", "1.9em")
    .attr("height", "1em")
    .attr("x", "-1.9em")
    .attr("y", "0.5em")
    .style("fill", "green");
    le.append("rect")
    .attr("width", "1.9em")
    .attr("height", "1em")
    .attr("x", "-1.9em")
    .attr("y", "1.5em")
    .style("fill", "#999");
    le.append("rect")
    .attr("width", "1.9em")
    .attr("height", "1em")
    .attr("x", "-1.9em")
    .attr("y", "2.5em")
    .style("fill", "yellow");
    
    le.append("line")
    .attr("x1", "-1.9em")
    .attr("x2", "0")
    .attr("y1", "6.3em")
    .attr("y2", "6.3em")
    .attr("stroke-width", 2)
    .style("stroke", "#000")
    .style("stroke-dasharray", "2,1")
    .attr("class", "reac")
    .style("display", "none");
  },
  render: function(){
    return (
        <div ref={(c) => this._div = c} className="Plot"></div>
        );
  }
});

var LocationPresets = React.createClass({
  getInitialState:function(){
    return {selectValue:'none'};
    },
  handleDetectorChange: function(e){
    // if the detector moves, the preset is not valid anymore
    this.setState({selectValue:'none'});
    window.removeEventListener("detectorPosition", this.handleDetectorChange);
  },
  handleChange:function(e){
    var value = e.target.value;
    var point = value.split(',');
    if (this.state.selectValue != 'none'){
      // this is tricky, we don't want to set things to None of the cause of the detector move was
      // because a different preset was selected, so remove the event handeler if that is the case
      window.removeEventListener("detectorPosition", this.handleDetectorChange);
    }

    this.setState({selectValue:value});
    updateDetectorPosition(point[1], point[0], 0);
    map.panTo([point[0], point[1]]);
    updateFollowMouse(false);
    window.addEventListener("detectorPosition", this.handleDetectorChange);
    },
  render: function(){
    return (
      <FormControl value={this.state.selectValue} onChange={this.handleChange} componentClass="select" placeholder="select">
      <option disabled value="none">Location Presets</option>
      {
        this.props.groups.map(function(group){
          return (
              <optgroup label={group.optgroup}>
              {group.children.map(function(child){
                  return (<option value={child.value}>{child.label}</option>);
                })};
              </optgroup>
              );
        })
      }
      </FormControl>
    );
  }
});

var StatsPanel = React.createClass({
  updateStats: function(){
    this.setState({
      total_tnu: d3.sum(spectrum.total) * 0.01,
      total_tnu_geo: d3.sum(spectrum.total.slice(0,326)) * 0.01,
      closest_tnu: d3.sum(spectrum.closest) * 0.01,
      closest_distance: distances.closest,
      custom_distance: distances.user,
      custom_tnu: d3.sum(spectrum.custom) * 0.01,
      geo_tnu: (d3.sum(spectrum.geo_u) + d3.sum(spectrum.geo_th)) * 0.01,
      geo_u_tnu: d3.sum(spectrum.geo_u) * 0.01,
      geo_th_tnu: d3.sum(spectrum.geo_th) * 0.01,
      reactors_tnu: (d3.sum(spectrum.iaea) + d3.sum(spectrum.custom)) * 0.01,
      geo_r: (d3.sum(spectrum.geo_th)/d3.sum(spectrum.geo_u))/0.066,
    });
  },
  componentDidMount: function(){
    window.addEventListener("spectrumUpdate", this.updateStats)
  },
  componentWillUnmount: function(){
    window.removeEventListener("spectrumUpdate", this.updateStats)
  },
  getInitialState: function(){
    return {
      total_tnu: 0,
      total_tnu_geo: 0,
      closest_tnu: 0,
      closest_distance: 0,
      custom_distance: 0,
      custom_tnu: 0,
      geo_tnu: 0,
      geo_u_tnu: 0,
      geo_th_tnu: 0,
      reactors_tnu: 0,
      geo_r: 0,
    }
  },
  render: function(){
    function userDisplay(use){
      if (use){
        return "inline";
      } else {
        return "none";
      }
    };
    return (
        <div>
          <i>R</i><sub>total</sub> = {this.state.total_tnu.toFixed(1)} TNU<br />
          <i>R</i><sub>reac</sub> = {this.state.reactors_tnu.toFixed(1)} TNU<br />
          <i>R</i><sub>closest</sub> = {this.state.closest_tnu.toFixed(1)} TNU ({(this.state.closest_tnu/this.state.total_tnu * 100).toFixed(1)} % of total)<br />
          <i>D</i><sub>closest</sub> = {this.state.closest_distance.toFixed(2)} km<br />
      <span style={{"display": userDisplay(customReactor.use)}}><i>D</i><sub>user</sub> = {this.state.custom_distance.toFixed(3)} km<br /></span>
      <span style={{"display": userDisplay(customReactor.use)}}><i>R</i><sub>user</sub> = {this.state.custom_tnu.toFixed(1)} TNU<br /></span>
          <i>R</i><sub>E &lt; 3.275 MeV</sub> = {this.state.total_tnu_geo.toFixed(1)} TNU<br />
      <i>R</i><sub>geo</sub> = {this.state.geo_tnu.toFixed(1)} TNU (U = {this.state.geo_u_tnu.toFixed(1)}, Th = {this.state.geo_th_tnu.toFixed(1)})<br />
          <i>Th/U</i><sub>geo</sub> = {this.state.geo_r.toFixed(1)}<br />
      <small>1 TNU = 1 event/10<sup>32</sup> free protons/year</small><br />
          <small>1 kT H<sub>2</sub>O contains 0.668559x10<sup>32</sup> free protons</small>
        </div>
        );
  }
});

var SpectrumPanel = React.createClass({
  handleMassInvert: function(){
    this.setState({"invertedMass": invertedMass});
  },
  componentDidMount: function(){
    window.addEventListener("invertedMass", this.handleMassInvert)
  },
  componentWillUnmount: function(){
    window.removeEventListener("invertedMass", this.handleMassInvert)
  },
  getInitialState: function(){
    return {
      invertedMass: false
    }
  },
  render: function(){
    return (
        <Panel header="Spectrum Stats">
    			<Checkbox onClick={updateInvertedMass} checked={this.state.invertedMass}>Inverted Neutrino Mass Ordering</Checkbox>
          <StatsPanel />
        </Panel>
        );
  }
});

var LocationPanel = React.createClass({
  handlePositionChange: function(){
    this.setState(detectorPosition);
  },
  handleMouseBoxChange: function(){
    this.setState({"followMouse":followMouse});
  },
  changeLat: function(e){
    var value = e.target.value;
    if (value.endsWith(".") || (value.match("\\.0*$") != null)){
      this.setState({lat:value});
      return;
    }
    updateDetectorPosition(detectorPosition.lon, value);
  },
  changeLon: function(e){
    var value = e.target.value;
    if (value.endsWith(".") || (value.match("\\.0*$") != null)){
      this.setState({lon:value});
      return;
    }
    updateDetectorPosition(value, detectorPosition.lat);
  },
  changeElevation: function(e){
    var value = e.target.value;
    if (isNaN(parseFloat(value))){
      this.setState({elevation:value});
      return;
    }
    if (parseFloat(value) > 10000){
      value = "10000";
    }
    if (parseFloat(value) < -10000){
      value = "-10000";
    }
    updateDetectorPosition(detectorPosition.lon, detectorPosition.lat, value);
  },
  getInitialState: function(){
    var state = {};
    state.lat = detectorPosition.lat;
    state.lon = detectorPosition.lon;
    state.elevation = detectorPosition.elevation;
    state.followMouse = followMouse;
    return state;
  },
  componentDidMount: function(){
    window.addEventListener("detectorPosition", this.handlePositionChange)
    window.addEventListener("mouseFollow", this.handleMouseBoxChange)
  },
  componentWillUnmount: function(){
    window.removeEventListener("detectorPosition", this.handlePositionChange)
    window.removeEventListener("mouseFollow", this.handleMouseBoxChange)
  },
  render: function(){
    return (
        <Panel header="Location">
          <Form horizontal>
           <FormGroup controlId="cursor_lat">
             <Col componentClass={ControlLabel} sm={2}>
               Latitude
             </Col>
             <Col sm={10}>
              <InputGroup>
               <FormControl onChange={this.changeLat} type="number" value={this.state.lat} />
                <InputGroup.Addon>deg N</InputGroup.Addon>
              </InputGroup>
             </Col>
           </FormGroup>

           <FormGroup controlId="cursor_lon">
             <Col componentClass={ControlLabel} sm={2}>
               Longitude
             </Col>
             <Col sm={10}>
              <InputGroup>
               <FormControl onChange={this.changeLon} type="number" value={this.state.lon} />
                <InputGroup.Addon>deg E</InputGroup.Addon>
              </InputGroup>
             </Col>
           </FormGroup>

           <FormGroup controlId="detector_elevation">
             <Col componentClass={ControlLabel} sm={2}>
               Elevation
             </Col>
             <Col sm={10}>
              <InputGroup>
               <FormControl onChange={this.changeElevation} type="number" value={this.state.elevation} />
                <InputGroup.Addon>meters</InputGroup.Addon>
              </InputGroup>
             </Col>
           </FormGroup>

           <FormGroup>
             <Col smOffset={2} sm={10}>
               <Checkbox onClick={updateFollowMouse} checked={this.state.followMouse}>Follow Cursor on Map</Checkbox>
             </Col>
           </FormGroup>


          <FormGroup controlId="detector_preset">
              <Col sm={12}>
                <LocationPresets groups={detectorPresets} />
              </Col>
            </FormGroup>

            <Button onClick={use_nav_pos} bsStyle="primary">Use My Current Position</Button>

        	</Form>
        </Panel>
    );
  }
});

var OutputText = React.createClass({
  getInitialState: function(){
    var state = {
      textContent: "Empty"
    };
    return state;
  },
  dealWithSpectrumUpdate: function(){
    var text_out = Array(1001);
    text_out[0] = "total,iaea,close,user,geo_u,geo_th";
    for (var i=0; i< spectrum.iaea.length; i++){
      if (i < 180){
        continue
      }
      text_out[i-180+1] = tof11(spectrum.total[i]) + "," + tof11(spectrum.iaea[i])+","+ tof11(spectrum.closest[i]) + "," + tof11(spectrum.custom[i]) + "," + tof11(spectrum.geo_u[i]) + "," + tof11(spectrum.geo_th[i]);
    }
    this.setState({textContent: text_out.join("\n")});
  },
  componentDidMount: function(){
    window.addEventListener('spectrumUpdate', this.dealWithSpectrumUpdate);
  },
  componentWillUnmount: function(){
    window.removeEventListener('spectrumUpdate', this.dealWithSpectrumUpdate);
  },
  render: function(){
    var textareaStyle = {
      width: "100%"
    };
    return (
        <Panel header="Output Data">
        <div>
        <p>
          Click the "Download Output" button below for a csv of the energy spectrum of the antineutrino interaction rate and its components at the selected location. 
          The data, with bin centers ranging from 1.805 to 9.995 MeV, are in units of TNU (#/10^32 free protons/year) per keV.
          Comma-seperated columns of data correspond to the components: total, sum of reactor cores, closest core, user-defined core (0 if not using a custom reactor), and U and Th geo-neutrinos.
          There are 820 rows of data in each column.
          The first row of data corresponds to the energy bin from 1.80 to 1.81 MeV, which includes the energy threshold of the electron antineutrino inverse beta decay interaction on a free proton.
          For plotting or further analysis, simply copy and paste the contents of this box into a text file or spreadsheet program.
          When using these data, cite: Barna, A.M. and Dye, S.T., "Web Application for Modeling Global Antineutrinos," arXiv:1510.05633 (2015).
        </p>
        <Button onClick={() => download(this.state.textContent, 'output.csv', 'text/csv')} bsStyle="success">Download Output</Button>
        </div>
      </Panel>
        )
  }
});

var MantlePanel = React.createClass({
  geoneutrinoEvent: function(){
    this.setState(geoneutrinos);
  },
  getInitialState: function(){
    return geoneutrinos;
  },
  handleMantleSignal: function(event){
    updateGeoneutrinos({"mantleSignal":event.target.value});
  },
  handleMantleRatio: function(event){
    updateGeoneutrinos({"thuRatio":event.target.value});
  },
  componentDidMount: function(){
    window.addEventListener("geoneutrinos", this.geoneutrinoEvent)
  },
  componentWillUnmount: function(){
    window.removeEventListener("geoneutrinos", this.geoneutrinoEvent)
  },
  render: function(){
    return (
        <Panel header="Mantle">
          <Form horizontal>
          <FormGroup controlId="mantle_signal">
            <Col componentClass={ControlLabel} sm={4}>
              Mantle Signal
            </Col>
            <Col sm={8}>
              <InputGroup>
                <FormControl onChange={this.handleMantleSignal} type="number" step="0.1" value={this.state.mantleSignal} />
                <InputGroup.Addon>TNU</InputGroup.Addon>
              </InputGroup>
            </Col>
          </FormGroup>
          <FormGroup controlId="mantle_thu">
            <Col componentClass={ControlLabel} sm={4}>
              Th/U Ratio
            </Col>
            <Col sm={8}>
              <FormControl onChange={this.handleMantleRatio} type="number" step="0.1" value={this.state.thuRatio} />
            </Col>
          </FormGroup>
          </Form>
        </Panel>
        )
  }
});

var CrustPanel = React.createClass({
  geoneutrinoEvent: function(){
    this.setState(geoneutrinos);
  },
  getInitialState: function(){
    return geoneutrinos;
  },
  handleCrust: function(event){
    updateGeoneutrinos({"crustSignal":event.target.checked});
  },
  componentDidMount: function(){
    window.addEventListener("geoneutrinos", this.geoneutrinoEvent)
  },
  componentWillUnmount: function(){
    window.removeEventListener("geoneutrinos", this.geoneutrinoEvent)
  },
  render: function(){
    return (
        <Panel header="Crust">
          <Checkbox onClick={this.handleCrust} checked={this.state.crustSignal}>Include Crust Signal</Checkbox>
          <div>
          We use a pre-computed model of the crust flux provided by W.F. McDonough and described in Y. Huang et al., "A reference Earth model for the heat producing elements and associated geoneutrino flux," Geochem., Geophys., Geosyst. 14, 2003 (2013).
          </div>
        </Panel>
        )
  }
});

var CalculatorPanel = React.createClass({
  getInitialState: function(){
    return {
      signal: "all",
      solve_for: "exposure",
      e_min: 0,
      e_max: 10,
      time: 0,
      sigma: 3
    }
  },
  handleUserInput: function(event){
    var key = event.target.id;
    var value = parseFloat(event.target.value);
    if (isNaN(value)){
      value = event.target.value;
    }
    this.solve({[key]: value});
  },
  componentDidMount: function(){
    window.addEventListener("spectrumUpdate", this.solve);
  },
  componentWillUnmount: function(){
    window.removeEventListener("spectrumUpdate", this.solve);
  },
  solve: function(stateUpdate={}){
    var newState = {}
    Object.assign(newState, this.state, stateUpdate);

    if (newState.e_min < 0){
      newState.e_min = 0;
    }
    if (newState.e_max < newState.e_min){
      newState.e_max = newState.e_min;
    }
    if (newState.sigma < 0){
      newState.sigma = 0;
    }
    if (newState.time < 0){
      newState.time = 0;
    }

    var min_i = parseInt(newState.e_min * 100);
    var max_i = parseInt(newState.e_max * 100);

    var signal = 0;
    var background = 0;

    if (newState.signal == "all"){
      signal = d3.sum(spectrum.iaea.slice(min_i, max_i))/100 + d3.sum(spectrum.custom.slice(min_i, max_i))/100;
      background = d3.sum(spectrum.geo_u.slice(min_i, max_i))/100 + d3.sum(spectrum.geo_th.slice(min_i, max_i))/100
    }
    if (newState.signal == "closest"){
      signal = d3.sum(spectrum.closest.slice(min_i, max_i))/100;
      background = d3.sum(spectrum.total.slice(min_i, max_i))/100  - d3.sum(spectrum.closest.slice(min_i, max_i))/100;
    }
    if (newState.signal == "custom"){
      signal = d3.sum(spectrum.custom.slice(min_i, max_i))/100;
      background = d3.sum(spectrum.total.slice(min_i, max_i))/100 - d3.sum(spectrum.custom.slice(min_i, max_i))/100;
    }
    if (newState.signal == "geoneutrino"){
      background = d3.sum(spectrum.iaea.slice(min_i, max_i))/100 + d3.sum(spectrum.custom.slice(min_i, max_i))/100;
      signal = d3.sum(spectrum.geo_u.slice(min_i, max_i))/100 + d3.sum(spectrum.geo_th.slice(min_i, max_i))/100;
    }
    if (newState.signal == "geo_u"){
      background = d3.sum(spectrum.iaea.slice(min_i, max_i))/100 + d3.sum(spectrum.custom.slice(min_i, max_i))/100 + d3.sum(spectrum.geo_th.slice(min_i, max_i))/100;
      signal = d3.sum(spectrum.geo_u.slice(min_i, max_i))/100 
    }
    if (newState.signal == "geo_th"){
      background = d3.sum(spectrum.iaea.slice(min_i, max_i))/100 + d3.sum(spectrum.custom.slice(min_i, max_i))/100 + d3.sum(spectrum.geo_u.slice(min_i, max_i))/100;
      signal =  d3.sum(spectrum.geo_th.slice(min_i, max_i))/100;
    }

    if (newState.solve_for == "exposure"){
      newState.time = ((signal + 2 * background) * (newState.sigma/signal) * (newState.sigma/signal)).toFixed(3);
    }
    if (newState.solve_for == "significance"){
      newState.sigma = signal * Math.sqrt(newState.time)/Math.sqrt(signal + 2 * background);
    }
    this.setState(newState);
  },
  render: function(){
    return (
    <Panel header="Calculator">
      <Form horizontal>

      <FormGroup controlId="signal">
        <Col componentClass={ControlLabel} sm={4}>
          Signal (bkgnd)
        </Col>
        <Col sm={8}>
          <FormControl onChange={this.handleUserInput} value={this.state.signal} componentClass="select">
            <option value="all">All Reactors (geoneutrino background)</option>
            <option value="closest">Closest Core (geonu + other reactors background)</option>
            <option value="custom">Custom Reactor (geonu + other reactors background)</option>
            <option value="geoneutrino">Geoneutrino (reactor background)</option>
            <option value="geo_u">Geoneutrino U (reactor + geo Th background)</option>
            <option value="geo_th">Geoneutrino Th (reactor + geo U background)</option>
          </FormControl>

      </Col>
    </FormGroup>

      <FormGroup controlId="solve_for">
        <Col componentClass={ControlLabel} sm={4}>
          Solve For
        </Col>
        <Col sm={8}>
          <FormControl onChange={this.handleUserInput} value={this.state.solve_for} componentClass="select">
            <option value="exposure">Exposure Time</option>
            <option value="significance">Significance</option>
          </FormControl>
        </Col>
      </FormGroup>

      <FormGroup controlId="e_min">
        <Col componentClass={ControlLabel} sm={4}>
          E<sub>min</sub>
        </Col>
        <Col sm={8}>
              <InputGroup>
          <FormControl onChange={this.handleUserInput} step="0.1" type="number" value={this.state.e_min} />
                <InputGroup.Addon>MeV</InputGroup.Addon>
              </InputGroup>
        </Col>
      </FormGroup>

      <FormGroup controlId="e_max">
        <Col componentClass={ControlLabel} sm={4}>
          E<sub>max</sub>
        </Col>
        <Col sm={8}>
              <InputGroup>
          <FormControl onChange={this.handleUserInput} step="0.1" type="number" value={this.state.e_max} />
                <InputGroup.Addon>MeV</InputGroup.Addon>
              </InputGroup>
        </Col>
      </FormGroup>

      <FormGroup controlId="time">
        <Col componentClass={ControlLabel} sm={4}>
          Time
        </Col>
        <Col sm={8}>
              <InputGroup>
          <FormControl onChange={this.handleUserInput} type="number" value={this.state.time} />
                <InputGroup.Addon>years</InputGroup.Addon>
              </InputGroup>
        </Col>
      </FormGroup>

      <FormGroup controlId="sigma">
        <Col componentClass={ControlLabel} sm={4}>
          N<sub>σ</sub>
        </Col>
        <Col sm={8}>
          <FormControl onChange={this.handleUserInput} type="number" value={this.state.sigma} />
        </Col>
      </FormGroup>

      </Form>
      <div> N<sub>σ</sub> = Signal * sqrt(Time) / sqrt(Signal + 2 * Background)</div>
    </Panel>
    )
  }
});

var ReactorListPanel = React.createClass({
  getInitialState(){
    return {lf: corelist, powerOverrides: powerOverrides};
  },
  updateReactorData(){
    this.setState({lf: corelist});
  },
  componentDidMount(){
    window.addEventListener("loadFactor", this.updateReactorData);
    window.addEventListener("useMaxPowerEvent", this.updateReactorData);
  },
  componentWillUnmount(){
    window.removeEventListener("loadFactor", this.updateReactorData);
    window.removeEventListener("useMaxPowerEvent", this.updateReactorData);
  },
  toggleReactorOverride(e){
    let name = e.target.name;
    let max = this.state.powerOverrides.max;
    let min = this.state.powerOverrides.min;
    if(max.includes(name)){
      max = max.filter(item => item !== name);
      min = min.concat([name]);
    }
    else if(min.includes(name)){
      min = min.filter(item => item !== name);
    }else{
      max = max.concat([name]);
    }
    const powerOverrides = {
      min: min,
      max: max,
    }
    updatePowerOverride(min, max);
    this.setState({powerOverrides:powerOverrides});

  },
  render: function(){
    var rows = this.state.lf.map((reactor) => {
      const getButton = (name) => {
        if(this.state.powerOverrides.max.includes(name)){
          return <button name={name} onClick={this.toggleReactorOverride}>Set 0</button>
        }
        if(this.state.powerOverrides.min.includes(name)){
          return <button name={name} onClick={this.toggleReactorOverride}>Set Default</button>
        }

        return <button name={name} onClick={this.toggleReactorOverride}>Set Max</button>
      }

      const getPower = (reactor) => {
        let name = reactor.name;
        let max = this.state.powerOverrides.max;
        let min = this.state.powerOverrides.min;
        if(max.includes(name)){
          return reactor.power.toFixed(1);
        }
        else if(min.includes(name)){
          return 0.0.toFixed(1)
        }else if(useMaxPower){
          if (reactor.operatingPower > 0){
            return reactor.power.toFixed(1);
          }else{
            return 0.0.toFixed(1);
          }
        }else{
          return reactor.operatingPower.toFixed(1)
        }
      }

      var bsStyle = ""
      if(reactor.power === 0){
        bsStyle = "danger"
      }
      return (
        <tr className={bsStyle}>
          <td>{reactor.name}</td>
          <td>{getPower(reactor)}</td>
          <td>{reactor.type}</td>
          <td>{getButton(reactor.name)}</td>
        </tr>
      )
    })
    return (
      <Panel  header="Reactor List: Name, Power(MW), Type, Power Override">
        <div style={{width: "100%", maxHeight:"40vh", overflowX:"scroll"}}>
        <Table fill condensed striped>
          <thead>
            <tr>
              <th>Name</th>
              <th>Power&nbsp;(MW)</th>
              <th>Type</th>
              <th>Power&nbsp;Override</th>
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </Table>
      </div>
      </Panel>
    )
  }
});


var ReactorLoadPanel = React.createClass({
  getInitialState: function(){
    return Object.assign({},
      loadFactor,
      {"useMaxPower":useMaxPower}
    )
  },

  handleYStartChange: function(event){
    var value = event.target.value;
    if((this.state.yend + this.state.mend) < (value + this.state.mstart)){
      value = this.state.yend;
    }
    updateLoadFactor({ystart: value});
    this.setState({"ystart": value});
  },
  handleMStartChange: function(event){
    var value = event.target.value;
    if((this.state.yend + this.state.mend) < (this.state.ystart + value)){
      value = this.state.mend;
    }
    updateLoadFactor({mstart: value});
    this.setState({"mstart": value});
  },
  handleYEndChange: function(event){
    var value = event.target.value;
    if((value + this.state.mend) < (this.state.ystart + this.state.mstart)){
      value = this.state.ystart;
    }
    updateLoadFactor({yend: value});
    this.setState({"yend": value});
  },
  handleMEndChange: function(event){
    var value = event.target.value;
    if((this.state.yend + value) < (this.state.ystart + this.state.mstart)){
      value = this.state.mstart;
    }
    updateLoadFactor({mend: value});
    this.setState({"mend": value});
  },

  handleUseCheckbox: function(event){
    let newUseMaxPower = !(this.state.useMaxPower);
    this.setState({useMaxPower:newUseMaxPower});
    updateUseMaxPower(newUseMaxPower);
  },
  render: function() {
    const years = [2003, 2004, 2005, 2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017];
    const months = ["01","02","03","04","05","06","07","08","09","10","11","12"];
    const yearOptions = years.map(function(year){
      return <option value={year}>{year}</option>
    });
    const monthOptions = months.map(function(month){
      return <option value={month}>{month}</option>
    });
    return (
    <Panel header="Thermal Powers">
      <Form inline>
    	  <FormGroup controlId="loadFactor">
    	    <FormControl onChange={this.handleUseCheckbox} value={this.state.useMaxPower} componentClass="select">
            <option value={false}>Mean</option>
            <option value={true}>Max</option>
          </FormControl>
    	  </FormGroup>
        &nbsp;default data from start to end of the following year-month pairs:
      </Form>
      <Form inline>
    	  <FormGroup controlId="loadFactor">
    	    <FormControl onChange={this.handleYStartChange} value={this.state.ystart} componentClass="select">
            {yearOptions}
          </FormControl>
    	  </FormGroup>
    	  <FormGroup controlId="loadFactor">
    	    <FormControl onChange={this.handleMStartChange} value={this.state.mstart} componentClass="select">
            {monthOptions}
          </FormControl>
    	  </FormGroup>
        &nbsp;–&nbsp;
    	  <FormGroup controlId="loadFactor">
    	    <FormControl onChange={this.handleYEndChange} value={this.state.yend} componentClass="select">
            {yearOptions}
          </FormControl>
    	  </FormGroup>
    	  <FormGroup controlId="loadFactor">
    	    <FormControl onChange={this.handleMEndChange} value={this.state.mend} componentClass="select">
            {monthOptions}
          </FormControl>
    	  </FormGroup>
      </Form>
    </Panel>
        )
  }
});

var CustomReactorPanel = React.createClass({
  getInitialState: function(){
    return customReactor;
  },
  handleTypeChange: function(event){
    var value = event.target.value;
    this.setState({"type":value});
    updateCustomReactor({"type":value});
  },
  handleUseCheckbox: function(event){
    var value = event.target.checked;
    this.setState({"use":value});
    updateCustomReactor({"use":value});
  },
  handleUserInput: function(event){
    var key = event.target.id;
    var value = event.target.value;
    this.setState({[key]:value});
    value = parseFloat(event.target.value);
    if (!Number.isNaN(value)){
      updateCustomReactor({[key]:value});
    }
  },
  render: function(){
    const types = Object.keys(Constants.FUEL_FRACTIONS).map(function(type){
      return <option value={type}>{type}</option>
    });
    return (
    <Panel header="Custom Reactor">
      <Form horizontal>
    	  <FormGroup controlId="power">
    	    <Col componentClass={ControlLabel} sm={2}>
            Power
    	    </Col>
    	    <Col sm={10}>
            <InputGroup>
    	        <FormControl onChange={this.handleUserInput} type="number" value={this.state.power} />
              <InputGroup.Addon>MW</InputGroup.Addon>
            </InputGroup>
    	    </Col>
    	  </FormGroup>
    	  <FormGroup controlId="type">
    	    <Col componentClass={ControlLabel} sm={2}>
            Type
    	    </Col>
    	    <Col sm={10}>
    	    <FormControl onChange={this.handleTypeChange} value={this.state.type} componentClass="select">
            {types}
          </FormControl>
          </Col>
    	  </FormGroup>
    	  <FormGroup controlId="use">
    	    <Col componentClass={ControlLabel} sm={2}>
    	    </Col>
    	    <Col sm={10}>
    			<Checkbox onChange={this.handleUseCheckbox} checked={this.state.use}>Use Custom Reactor</Checkbox>
    	    </Col>
    	  </FormGroup>
      </Form>
      <Panel header="Location">
        	<Form horizontal>
    				<FormGroup controlId="lat">
    				  <Col componentClass={ControlLabel} sm={4}>
                Latitude
    				  </Col>
    				  <Col sm={8}>
              <InputGroup>
    				    <FormControl onChange={this.handleUserInput} type="number" value={this.state.lat} />
                <InputGroup.Addon>deg N</InputGroup.Addon>
              </InputGroup>
    				  </Col>
    				</FormGroup>

    				<FormGroup controlId="lon">
    				  <Col componentClass={ControlLabel} sm={4}>
                Longitude
    				  </Col>
    				  <Col sm={8}>
              <InputGroup>
    				    <FormControl onChange={this.handleUserInput} type="number" value={this.state.lon} />
                <InputGroup.Addon>deg E</InputGroup.Addon>
              </InputGroup>
    				  </Col>
    				</FormGroup>
            </Form>
      </Panel>
    </Panel>
      );
  }
});

var RatPacPanel = React.createClass({
  getInitialState: function(){
    return {"output": "total",
      "value": this.makeRatPac("total", [])
    };
  },
  makeRatPac(name, spec){
    var mevs = new Array(1000);
    for (var i=0; i < mevs.length; i++){
      mevs[i] = (i+1)/100;
    }
    mevs = mevs.map(function(elm){return elm.toFixed(2) + "d"}).join(", ");
    var pev = spec.slice(179).concat(spec.slice(0,179)).map(function(elm){return elm.toFixed(4) + "d"}).join(", ");
    return "{\nname: \"SPECTRUM\",\nindex: \""+name+"\",\nvalid_begin: [0, 0],\nvalid_end: [0, 0],\nspec_e: ["+mevs+"],\nspec_mag: ["+pev+"],\n}";
  },
  dealWithSpectrumUpdate: function(){
    this.setState({value: this.makeRatPac(this.state.output, spectrum[this.state.output])});
  },
  componentDidMount: function(){
    window.addEventListener('spectrumUpdate', this.dealWithSpectrumUpdate);
  },
  componentWillUnmount: function(){
    window.removeEventListener('spectrumUpdate', this.dealWithSpectrumUpdate);
  },
  handleChange: function(e){
    var value = e.target.value;
    this.setState({"output": value,
      "value": this.makeRatPac(value, spectrum.total)
    });
  },
  render: function() {
    var textareaStyle = {
      width: "100%"
    };
    return (
    <Panel header="RAT-PAC Output">
      <Form horizontal>
    	  <FormGroup controlId="ratpackout">
    	  <Col sm={12}>
    	    <FormControl onChange={this.handleChange} value={this.state.output} componentClass="select">
            <option value="total">Total</option>
            <option value="iaea">IAEA</option>
            <option value="closest">Closest Reactor</option>
            <option value="custom">Custom Reactor</option>
          </FormControl>
    	  </Col>
    	  </FormGroup>
      </Form>
      <textarea readonly={true} rows={4} style={textareaStyle} name={"ratpac"} value={this.state.value} />
    </Panel>
        )
  }
});

var ConfigPanel = React.createClass({
  render: function() {
    return (
      <Panel header="Input Parameters">
        This is a <a href="https://en.wikipedia.org/wiki/JSON">JSON</a> representation of the
        actual config variables used in the calculations. The <a href="https://github.com/DocOtak/geoneutrinos/blob/gh-pages/_jsx/config.js">source file</a> is available.
        Any calculation performed using any of these variables will import the value from that config file and use it.
        <pre>
        {JSON.stringify(Constants, null, 1)}
      </pre>
      </Panel>
    )
  }
});



var Application = React.createClass({
  componentDidMount: function(){
    window.dispatchEvent(detectorPositionUpdate);
  },
  render: function(){
    return (
      <div>
        <Plot />
      <Tabs defaultActiveKey={1} animation={false} id="noanim-tab-example">
        <Tab eventKey={1} title="Detector">
          <SpectrumPanel />
          <LocationPanel />
        </Tab>
        <Tab eventKey={2} title="Reactors">
          <ReactorLoadPanel />
          <ReactorListPanel />
          <CustomReactorPanel />
        </Tab>
        <Tab eventKey={3} title="GeoNu">
          <MantlePanel />
          <CrustPanel />
        </Tab>
        <Tab eventKey={4} title="Output">
          <CalculatorPanel />
          <OutputText />
        </Tab>
        <Tab eventKey={5} title="Inputs">
          <ConfigPanel />
        </Tab>
      </Tabs>
    </div>
    );
  }
});

ReactDOM.render(
  <Application />,
  document.getElementById('application')
);

