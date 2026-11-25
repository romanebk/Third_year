#pragma once

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <typeindex>
#include <unordered_map>
#include <utility>
#include <vector>

namespace engine {

// Typed publish/subscribe: systems talk through events instead of calling each
// other (Mediator pattern). An event is any copyable struct.
//
//   struct Goal { int side; };
//   auto token = bus.subscribe<Goal>([](const Goal &g) { ... });
//   bus.publish(Goal{1});      // handlers run now
//   bus.enqueue(Goal{1});      // handlers run at the next dispatch()
//   bus.unsubscribe(token);
//
// enqueue + dispatch lets a system emit events while it iterates over the
// registry, and react to them once the iteration is over. Not thread-safe.
class EventBus {
public:
    using Token = std::uint64_t;

    template <typename Event, typename Handler>
    Token subscribe(Handler &&handler)
    {
        const Token token = _nextToken++;
        _handlers[std::type_index(typeid(Event))].push_back(
            {token, [h = std::forward<Handler>(handler)](const void *event) {
                 h(*static_cast<const Event *>(event));
             }});
        return token;
    }

    // Returns false if the token is unknown (already removed).
    bool unsubscribe(Token token)
    {
        for (auto &[type, list] : _handlers) {
            const auto it = std::find_if(list.begin(), list.end(),
                                         [token](const Entry &e) { return e.token == token; });
            if (it != list.end()) {
                list.erase(it);
                return true;
            }
        }
        return false;
    }

    // Calls every handler of Event now, in subscription order. A handler may
    // subscribe or unsubscribe: the change applies to the next publish.
    template <typename Event>
    void publish(const Event &event) const
    {
        const auto it = _handlers.find(std::type_index(typeid(Event)));
        if (it == _handlers.end()) {
            return;
        }
        const std::vector<Entry> handlers = it->second; // copy: handlers may change the list
        for (const Entry &e : handlers) {
            e.call(&event);
        }
    }

    // Stores the event; it is published by the next dispatch().
    template <typename Event>
    void enqueue(Event event)
    {
        _queue.emplace_back([this, ev = std::move(event)]() { publish(ev); });
    }

    // Publishes the queued events in order and returns how many. Events queued
    // by the handlers themselves wait for the following dispatch().
    std::size_t dispatch()
    {
        std::vector<std::function<void()>> pending;
        pending.swap(_queue);
        for (const auto &deliver : pending) {
            deliver();
        }
        return pending.size();
    }

    template <typename Event>
    [[nodiscard]] std::size_t subscriberCount() const
    {
        const auto it = _handlers.find(std::type_index(typeid(Event)));
        return it == _handlers.end() ? 0 : it->second.size();
    }

    [[nodiscard]] std::size_t pendingCount() const noexcept { return _queue.size(); }

private:
    struct Entry {
        Token token;
        std::function<void(const void *)> call;
    };

    std::unordered_map<std::type_index, std::vector<Entry>> _handlers;
    std::vector<std::function<void()>> _queue;
    Token _nextToken = 1;
};

} // namespace engine
