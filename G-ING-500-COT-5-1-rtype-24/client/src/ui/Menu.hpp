#pragma once

// A vertical list of choices, used by every menu screen.
// Keyboard: Up/Down to move, Enter/Space to choose, Left/Right to change a
// value, Escape to go back. Mouse: move over a line and click.
// For blind players, the voice reads the selected line when it changes.

#include "SoundPlayer.hpp"
#include "game/world.hpp"

#include <SFML/Graphics/Font.hpp>
#include <SFML/Graphics/RenderWindow.hpp>
#include <SFML/Window/Event.hpp>
#include <string>
#include <vector>

namespace client {

enum class MenuAction { None, Choose, Left, Right, Back };

class Menu {
public:
    // `centerX` and `width` place the column (game coordinates); by default it
    // is centered in the arena.
    Menu(SoundPlayer &sounds, float top, float centerX = game::kArenaWidth / 2.0f,
         float width = 600.0f, float lineHeight = 36.0f);

    // The texts can change every frame (for example "Music: 50%"). If the
    // text of the selected line changes, the voice reads the new one.
    void setItems(const std::vector<std::string> &items);
    // The voice reads the selected line (after the current words if not `interrupt`).
    void speakSelected(bool interrupt = true);
    int getSelected() const { return _selected; }

    MenuAction handleEvent(const sf::Event &event, const sf::RenderWindow &window);
    void draw(sf::RenderWindow &window, const sf::Font &font) const;

private:
    int getItemAt(sf::Vector2f position) const;

    SoundPlayer &_sounds;
    std::vector<std::string> _items;
    int _selected = 0;
    float _top; // y of the first line
    float _centerX;
    float _width;
    float _lineHeight;
};

} // namespace client
