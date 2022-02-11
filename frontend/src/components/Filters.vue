<template>
  <v-container>
    <v-row>
      <v-col cols="12" sm="11">
        <!-- <v-text-field
          v-model="search_term"
          label="Search"
          clearable
        ></v-text-field> -->
      </v-col>
      <v-col cols="12" sm="1">
        <v-btn
          icon
          @click="expanded_filters = !expanded_filters"
          class="align-center"
          ><v-icon v-if="expanded_filters">mdi-chevron-up</v-icon
          ><v-icon v-else>mdi-chevron-down</v-icon></v-btn
        >
      </v-col>
    </v-row>
    <v-row v-if="expanded_filters">
      <v-col cols="12" sm="6" class="grey lighten-5 mb-6">
        <v-container>
          <v-row>
            <v-col class=".text-h3"> Weights for reviews </v-col>
          </v-row>
          <v-row v-for="weight of weigths" :key="weight.name">
            <v-col cols="12" sm="2">
              <v-label>{{ weight.readable_name }} </v-label>
            </v-col>
            <v-col cols="12" sm="10">
              <v-slider
                v-model="weight.value"
                :max="1"
                :min="0"
                step="0.1"
                :color="weight.color"
                class="align-center"
              >
                <template v-slot:append>
                  <v-text-field
                    v-model="weight.value"
                    class="mt-0 pt-0"
                    type="number"
                    style="width: 60px"
                  ></v-text-field>
                </template>
              </v-slider>
            </v-col>
          </v-row>
        </v-container>
      </v-col>
      <v-col cols="12" sm="6" class="grey lighten-5 mb-6">
        <v-container>
          <v-row>
            <v-col class=".text-h3"> Location settings </v-col>
          </v-row>
          <v-row>
            <v-col cols="12" sm="2"> <v-label>Place</v-label> </v-col>
            <v-col cols="12" sm="10"
              ><location-search v-model="location"></location-search>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12" sm="2"> <v-label>Distance</v-label> </v-col>
            <v-col cols="12" sm="10">
              <v-slider
                v-model="distance_km"
                :max="150"
                :min="0"
                class="align-center"
                thumb-label="always"
                thumb-siue="50px"
              >
                <template v-slot:thumb-label="{ value }">
                  {{ value }}km
                </template>
              </v-slider>
            </v-col>
          </v-row>
        </v-container>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import LocationSearch from "./LocationSearch.vue";
export default {
  name: "filters",
  components: { LocationSearch },
  props: {
    input: Object,
  },
  data: () => ({
    search_term: "",
    expanded_filters: true,
    location: null,
    weigths: [
      {
        name: "falstaff",
        readable_name: "Falstaff",
        value: 0.5,
        color: "blue",
      },
      {
        name: "google",
        readable_name: "Google",
        value: 0.5,
        color: "red",
      },
      {
        name: "tripadvisor",
        readable_name: "Tripadvisor",
        value: 0.5,
        color: "darkgreen",
      },
    ],
    distance_km: 10,
  }),
  watch: {
    search_term() {
      this.emit_data();
    },
    location() {
      this.emit_data();
    },
    distance_km() {
      this.emit_data();
    },
    weigths: {
      deep: true,
      handler() {
        this.emit_data();
      },
    },
  },
  methods: {
    emit_data() {
      this.$emit("input", {
        search: this.search_term,
        distance: this.distance_km * 1000,
        weigths: this.weigths,
        location: this.location,
      });
    },
  },
};
</script>
