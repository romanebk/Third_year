/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de NetworkConfig.hpp
** Dépend de : include/mytorch/NetworkConfig.hpp
*/

#include "mytorch/NetworkConfig.hpp"

#include <algorithm>
#include <fstream>
#include <sstream>

#include "mytorch/Errors.hpp"
#include "mytorch/Init.hpp"
#include "mytorch/StringUtils.hpp"

namespace mytorch {

namespace {

using KeyValues = std::vector<std::pair<std::string, std::string>>;

KeyValues readEntries(std::istream &in)
{
    KeyValues entries;
    std::string line;
    std::size_t lineNum = 0;
    while (std::getline(in, line)) {
        lineNum++;
        std::string content = trim(line);
        if (content.empty() || content[0] == '#')
            continue;
        std::size_t equal = content.find('=');
        if (equal == std::string::npos)
            throw FormatError("NetworkConfig: ligne " + std::to_string(lineNum) +
                              " sans '=' : " + content);
        entries.emplace_back(trim(content.substr(0, equal)), trim(content.substr(equal + 1)));
    }
    return entries;
}

std::size_t toSize(const std::string &key, const std::string &value)
{
    try {
        std::size_t used = 0;
        unsigned long long parsed = std::stoull(value, &used);
        if (used != value.size())
            throw std::invalid_argument("reste");
        return static_cast<std::size_t>(parsed);
    } catch (const std::exception &) {
        throw FormatError("NetworkConfig: valeur invalide pour '" + key + "' : " + value);
    }
}

float toFloat(const std::string &key, const std::string &value)
{
    try {
        std::size_t used = 0;
        float parsed = std::stof(value, &used);
        if (used != value.size())
            throw std::invalid_argument("reste");
        return parsed;
    } catch (const std::exception &) {
        throw FormatError("NetworkConfig: valeur invalide pour '" + key + "' : " + value);
    }
}

std::vector<std::size_t> toSizes(const std::string &key, const std::string &value)
{
    std::vector<std::size_t> sizes;
    std::istringstream stream(value);
    std::string item;
    while (stream >> item)
        sizes.push_back(toSize(key, item));
    if (sizes.empty())
        throw FormatError("NetworkConfig: liste vide pour '" + key + "'");
    return sizes;
}

void applyArchitecture(NetworkConfig &config, const std::string &key, const std::string &value)
{
    if (key == "input_size")
        config.inputSize = toSize(key, value);
    else if (key == "num_classes")
        config.numClasses = toSize(key, value);
    else if (key == "hidden_sizes")
        config.hiddenSizes = toSizes(key, value);
    else if (key == "label")
        config.labels.push_back(value);
    else if (key == "hidden_activation")
        config.hiddenActivation = value;
    else if (key == "hidden_init")
        config.hiddenInit = value;
    else if (key == "output_init")
        config.outputInit = value;
}

void applyTraining(NetworkConfig &config, const std::string &key, const std::string &value)
{
    if (key == "epochs")
        config.training.epochs = toSize(key, value);
    else if (key == "batch_size")
        config.training.batchSize = toSize(key, value);
    else if (key == "learning_rate")
        config.training.learningRate = toFloat(key, value);
    else if (key == "momentum")
        config.training.momentum = toFloat(key, value);
    else if (key == "l2")
        config.training.l2 = toFloat(key, value);
    else if (key == "dropout")
        config.training.dropout = toFloat(key, value);
    else if (key == "seed")
        config.training.seed = static_cast<std::uint32_t>(toSize(key, value));
}

const std::vector<std::string> kKnownKeys = {
    "input_size", "num_classes", "hidden_sizes", "label",
    "hidden_activation", "hidden_init", "output_init",
    "epochs", "batch_size", "learning_rate", "momentum", "l2", "dropout", "seed"};

bool isKnownKey(const std::string &key)
{
    return std::find(kKnownKeys.begin(), kKnownKeys.end(), key) != kKnownKeys.end();
}

void validateConfig(const NetworkConfig &config)
{
    if (config.hiddenSizes.empty())
        throw FormatError("NetworkConfig: 'hidden_sizes' est obligatoire");
    if (config.inputSize == 0 || config.numClasses == 0)
        throw FormatError("NetworkConfig: 'input_size' et 'num_classes' doivent être non nuls");
    if (config.labels.size() != config.numClasses)
        throw FormatError("NetworkConfig: " + std::to_string(config.labels.size()) +
                          " libellé(s) pour " + std::to_string(config.numClasses) + " classes");
    if (config.training.learningRate <= 0.0f)
        throw FormatError("NetworkConfig: 'learning_rate' doit être strictement positif");
    if (config.training.momentum < 0.0f || config.training.momentum >= 1.0f)
        throw FormatError("NetworkConfig: 'momentum' doit être compris entre 0 et 1");
    if (config.training.dropout < 0.0f || config.training.dropout > 0.0f)
        throw FormatError("NetworkConfig: 'dropout' doit être 0 (aucune couche Dropout n'est disponible)");
    initStrategyFromName(config.hiddenInit);
    initStrategyFromName(config.outputInit);
}

} // namespace

NetworkConfig readConfigFile(const std::string &path)
{
    std::ifstream in(path);
    if (!in.is_open())
        throw FileError("NetworkConfig: impossible d'ouvrir le fichier '" + path + "'");
    NetworkConfig config;
    for (const auto &entry : readEntries(in)) {
        if (!isKnownKey(entry.first))
            throw FormatError("NetworkConfig: clé inconnue '" + entry.first + "'");
        applyArchitecture(config, entry.first, entry.second);
        applyTraining(config, entry.first, entry.second);
    }
    validateConfig(config);
    return config;
}

} // namespace mytorch
