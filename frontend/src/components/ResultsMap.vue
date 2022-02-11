
<template>
  <v-container>
    <v-row>
      <v-col>
        <v-btn block @click="expanded_map = !expanded_map" class="align-center">
          <div v-if="expanded_map">Hide Map</div>
          <div v-else>Show Map</div>
          <v-icon v-if="expanded_map">mdi-chevron-up</v-icon
          ><v-icon v-else>mdi-chevron-down</v-icon></v-btn
        >
      </v-col>
    </v-row>
    <v-row v-if="expanded_map">
      <v-col cols="12" sm="12">
        <l-map style="height: 600px" :zoom="zoom" :center="center">
          <l-tile-layer :url="url" :attribution="attribution"></l-tile-layer>
          <l-marker
            v-for="result of results_filtered"
            :key="result._id"
            :lat-lng="result.location.coordinates"
          >
            <l-tooltip
              >{{ result.name }}<br />
              <div v-for="rating of result.ratings" :key="rating.rated_by">
                {{ rating.rated_by }}: {{ rating.score }}/{{ rating.score_max
                }}<br /></div
            ></l-tooltip>
          </l-marker>
        </l-map>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import _ from "lodash";
export default {
  name: "result-map",
  props: {
    results: Array,
    loading: Boolean,
    total: Number,
    distance: Number,
    zoom_to: String,
  },
  watch: {
    zoom_to() {},
  },
  computed: {
    results_filtered() {
      let results_filtered = [];
      for (let result of this.results) {
        if (result.location) {
          let result_copy = _.cloneDeep(result);
          let latlng = [...result.location.coordinates].reverse();
          result_copy.location.coordinates = latlng;
          results_filtered.push(result_copy);
        }
      }
      return results_filtered;
    },
    minmax() {
      let max_lng = -90;
      let max_lat = -180;
      let min_lng = 90;
      let min_lat = 180;
      for (let result of this.results_filtered) {
        let lng = result.location.coordinates[1];
        let lat = result.location.coordinates[0];
        if (lng > max_lng) {
          max_lng = lng;
        } else if (lng < min_lng) {
          min_lng = lng;
        }
        if (lat > max_lat) {
          max_lat = lat;
        } else if (lat < min_lat) {
          min_lat = lat;
        }
      }
      return { max_lng, min_lng, max_lat, min_lat };
    },
    center() {
      console.log("zooming to", this.zoom_to);
      if (this.zoom_to) {
        for (let result of this.results) {
          if (result._id == this.zoom_to) {
            let lng = result.location.coordinates[1];
            let lat = result.location.coordinates[0];
            return [lng, lat];
          }
        }
      }
      let { max_lng, min_lng, max_lat, min_lat } = this.minmax;
      let avg = [(max_lat + min_lat) / 2, (max_lng + min_lng) / 2];
      console.log("avg:", avg);
      return avg;
    },
    zoom() {
      if (this.zoom_to) {
        for (let result of this.results) {
          if (result._id == this.zoom_to) {
            return 14;
          }
        }
      }
      let { max_lng, min_lng, max_lat, min_lat } = this.minmax;
      let zoom = Math.log2(90 / (max_lat - min_lat));
      if (isNaN(zoom)) {
        zoom = 15;
      }
      console.log("Desired zoom is", zoom);
      return zoom;
    },
  },
  data: () => ({
    expanded_map: true,
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a target="_blank" href="http://osm.org/copyright">OpenStreetMap</a> contributors',
  }),
};
</script>
