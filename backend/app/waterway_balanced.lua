-- Motorboat routing profile for OSRM
-- Balanced filtering: allow main waterways, exclude small streams/ditches

api_version = 4

function setup()
  return {
    properties = {
      max_speed_for_map_matching = 50,
      weight_name = 'duration',
      process_call_tagless_node = false,
      u_turn_penalty = 20,
      continue_straight_at_waypoint = true,
      use_turn_restrictions = false,
    },

    default_mode = 1,
    default_speed = 10,

    -- Main navigable waterways
    waterway_speeds = {
      river = 15,
      canal = 12,
      fairway = 20,
      tidal_channel = 15,
      flowline = 10  -- Virtual connection lines between waterways
      -- Excluded: stream, ditch, drain (too small for motorboats)
    },

    route_speeds = {
      ferry = 15
    }
  }
end

function process_node(profile, node, result, relations)
  -- Simple node processing
end

function process_way(profile, way, result, relations)
  local waterway = way:get_value_by_key('waterway')
  local route = way:get_value_by_key('route')
  local name = way:get_value_by_key('name')

  -- Check for waterways
  if waterway and profile.waterway_speeds[waterway] then
    local speed = profile.waterway_speeds[waterway]

    -- Zugangs-Regeln: explizite Freigabe gewinnt, explizites Verbot sperrt.
    -- Prioritaet: motorboat (spezifischstes Tag) > boat > access > CEMT
    local access = way:get_value_by_key('access')
    local motorboat = way:get_value_by_key('motorboat')
    local motor_boat = way:get_value_by_key('motor_boat')
    local boat = way:get_value_by_key('boat')
    local cemt = way:get_value_by_key('CEMT')

    if motorboat == 'no' or motor_boat == 'no' then
      return
    end
    local explicitly_allowed = (motorboat == 'yes' or motor_boat == 'yes')
    if not explicitly_allowed then
      if boat == 'no' then
        return
      end
      explicitly_allowed = (boat == 'yes')
    end
    if not explicitly_allowed then
      if access == 'no' or access == 'private' then
        return
      end
      -- Amtliche CEMT-Klasse (ausser 0) = klassifizierte Wasserstrasse
      explicitly_allowed = (cemt ~= nil and cemt ~= '0')
    end

    -- EXCLUDE Altarme und Hochwasser-Entlastungsgewaesser — nicht schiffbar
    -- (z.B. Elbe-Umflutkanal/"Umflutehle" bei Magdeburg: gesperrt, Pretziener
    -- Wehr, in OSM ohne Sperr-Tags). Explizit freigegebene bleiben drin — der
    -- schiffbare Dahme-Umflutkanal ist boat=yes/motorboat=yes getaggt.
    if not explicitly_allowed and name then
      local name_lower = string.lower(name)
      if string.find(name_lower, 'alte ') or
         string.find(name_lower, 'altarm') or
         string.find(name_lower, 'nebenarm') or
         string.find(name_lower, 'seitenarm') or
         string.find(name_lower, 'umflut') or
         string.find(name_lower, 'flutkanal') or
         string.find(name_lower, 'flutmulde') or
         string.find(name_lower, 'flutgraben') or
         string.find(name_lower, 'hochwasser') then
        return
      end
    end

    -- For rivers ohne explizite Freigabe: filter out very small ones
    if waterway == 'river' and not explicitly_allowed then
      -- Check width - if tagged and < 10m, it's probably too small
      local width = tonumber(way:get_value_by_key('width'))
      if width and width < 10 then
        return
      end

      -- If it has a CEMT class of 0, it's not navigable
      if cemt == '0' then
        return
      end
    end

    -- Accept all canals, fairways, and tidal channels
    -- (they are infrastructure built for navigation)

    result.forward_mode = profile.default_mode
    result.backward_mode = profile.default_mode
    result.forward_speed = speed
    result.backward_speed = speed

  -- Ferry routes
  elseif route == 'ferry' then
    result.forward_mode = profile.default_mode
    result.backward_mode = profile.default_mode
    result.forward_speed = profile.route_speeds.ferry
    result.backward_speed = profile.route_speeds.ferry
  end
end

function process_segment(profile, segment)
  -- No special segment processing
end

function process_turn(profile, turn)
  turn.duration = 0
  turn.weight = 0
end

return {
  setup = setup,
  process_way = process_way,
  process_node = process_node,
  process_segment = process_segment,
  process_turn = process_turn
}
