-- Waterway routing profile for OSRM
-- Optimized for boat/ship navigation on rivers, canals, and waterways

api_version = 4

Set = require('lib/set')
Sequence = require('lib/sequence')
Handlers = require("lib/way_handlers")
Relations = require("lib/relations")
find_access_tag = require("lib/access").find_access_tag

function setup()
  return {
    properties = {
      max_speed_for_map_matching      = 180/3.6, -- 180kmph -> m/s
      weight_name                     = 'duration',
      process_call_tagless_node      = false,
      u_turn_penalty                 = 20,
      continue_straight_at_waypoint  = true,
      use_turn_restrictions          = false,
      left_hand_driving              = false,
    },

    default_mode            = mode.ferry,
    default_speed           = 10,
    oneway_handling         = true,

    -- Waterway types and their speeds (km/h)
    waterway_speeds = {
      river           = 15,
      canal           = 12,
      fairway         = 20,
      tidal_channel   = 15,
      stream          = 8,
      ditch           = 5,
      drain           = 5
    },

    -- Route types for ferries
    route_speeds = {
      ferry = 15
    },

    -- Access tags for waterways
    access_tags = Sequence {
      'motor_boat',
      'boat',
      'ship',
      'vessel'
    },

    -- Restrictions
    restricted_access_tags = Sequence {
      'no',
      'private'
    }
  }
end

function process_node(profile, node, result, relations)
  -- Process nodes for locks, bridges, etc.
  local barrier = node:get_value_by_key("barrier")
  local lock = node:get_value_by_key("lock")
  
  if barrier then
    result.barrier = true
    result.traffic_lights = false
  end
  
  if lock == "yes" then
    -- Add penalty for locks
    result.traffic_lights = true
  end
end

function process_way(profile, way, result, relations)
  local waterway = way:get_value_by_key('waterway')
  local route = way:get_value_by_key('route')
  local name = way:get_value_by_key('name')
  
  -- Check if this is a waterway
  if waterway then
    local speed = profile.waterway_speeds[waterway]
    if speed then
      -- Set the speed
      result.forward_speed = speed
      result.backward_speed = speed
      
      -- Set mode
      result.forward_mode = mode.ferry
      result.backward_mode = mode.ferry
      
      -- Check for one-way waterways
      local oneway = way:get_value_by_key('oneway')
      if oneway == "yes" or oneway == "1" or oneway == "true" then
        result.backward_mode = mode.inaccessible
      elseif oneway == "-1" then
        result.forward_mode = mode.inaccessible
        result.backward_mode = mode.ferry
      end
      
      -- Check access restrictions
      local access = way:get_value_by_key('access')
      local motor_boat = way:get_value_by_key('motor_boat')
      local boat = way:get_value_by_key('boat')
      
      if access == "no" or access == "private" or 
         motor_boat == "no" or boat == "no" then
        result.forward_mode = mode.inaccessible
        result.backward_mode = mode.inaccessible
      end
      
      -- Set name if available
      if name then
        result.name = name
      end
      
      return
    end
  end
  
  -- Check for ferry routes
  if route == "ferry" then
    result.forward_speed = profile.route_speeds.ferry
    result.backward_speed = profile.route_speeds.ferry
    result.forward_mode = mode.ferry
    result.backward_mode = mode.ferry
    
    if name then
      result.name = name
    end
    
    return
  end
end

function process_turn(profile, turn)
  -- No turn restrictions for waterways
  turn.duration = 0
  turn.weight = 0
end

return {
  setup = setup,
  process_way = process_way,
  process_node = process_node,
  process_turn = process_turn
}
