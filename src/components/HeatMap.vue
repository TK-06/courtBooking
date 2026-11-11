<script setup>
defineProps({ columns:{ type:Array, required:true }, label:{ type:String, default:'Heat map of hours on court over the last 12 weeks.' } })
</script>
<template>
  <div class="heat">
    <div class="heat-in" role="img" :aria-label="label">
      <span class="heat-m"></span><span v-for="c in columns" :key="'m' + c.key" class="heat-m">{{ c.month }}</span>
      <template v-for="r in 7" :key="'r' + r">
        <span class="heat-d">{{ ['Mon','','Wed','','Fri','','Sun'][r - 1] }}</span>
        <span v-for="c in columns" :key="c.key + '-' + r" class="hc" :class="c.days[r - 1].cls" :title="c.days[r - 1].title"></span>
      </template>
    </div>
  </div>
  <div class="heat-legend"><span><i class="hc"></i>No game</span><span><i class="hc h1"></i>1 hour</span><span><i class="hc h2"></i>2 hours</span><span><i class="hc up"></i>Booked</span></div>
</template>
