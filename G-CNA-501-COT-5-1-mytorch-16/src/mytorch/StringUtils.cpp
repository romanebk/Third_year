/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de StringUtils.hpp
** Dépend de : include/mytorch/StringUtils.hpp
*/

#include "mytorch/StringUtils.hpp"

namespace mytorch {

std::string trim(const std::string &text)
{
    const std::string blanks = " \t\r\n";
    std::size_t begin = text.find_first_not_of(blanks);
    if (begin == std::string::npos)
        return "";
    std::size_t end = text.find_last_not_of(blanks);
    return text.substr(begin, end - begin + 1);
}

} // namespace mytorch
